import { requireUser } from "../../../lib/auth.js";
import { getOwnedMeeting, consumeQuota, saveDeliveryLogs, listTasks } from "../../../lib/supabase.js";
import { publishToNotion, postWebhook } from "../../../lib/publishers.js";
import { buildPostMeetingEmail } from "../../../lib/templates.js";
import { config } from "../../../lib/config.js";
import { AppError, sendError } from "../../../lib/http.js";
export const maxDuration = 60;
export default async function handler(req, res) {
  if (req.method !== "POST") { res.setHeader("Allow", "POST"); return res.status(405).end(); }
  res.setHeader("Cache-Control", "no-store");
  try {
    const user = await requireUser(req);
    const { meeting_id, channel } = req.body || {};
    if (!["notion", "slack", "teams"].includes(channel)) throw new AppError("Choose a supported channel.", 400);
    const meeting = await getOwnedMeeting(meeting_id, user.id);
    if (!meeting.output_snapshot) throw new AppError("Save the reviewed draft first.", 400);
    const [actions] = await Promise.all([listTasks(user.id, meeting.id), consumeQuota(user.id, "publish", 10)]);
    const structured = { ...meeting.output_snapshot, action_items: actions };
    if (channel === "notion" && !actions.length) throw new AppError("There are no action items to publish to Notion.", 400);
    const result = channel === "notion" ? await publishToNotion({ meeting, structured }) : await postWebhook(channel === "slack" ? config.slackWebhookUrl : config.teamsWebhookUrl, { text: buildPostMeetingEmail({ meeting, tasks: structured.action_items, prepQuestions: structured.prep_questions }) });
    if (result.skipped) throw new AppError("This channel is not configured. You can copy the draft instead.", 503);
    const success = channel === "notion" ? result.created.every((item) => item.ok) : result.ok;
    await saveDeliveryLogs({ meetingId: meeting_id, results: { [channel]: { ok: success } } }).catch(() => {});
    return res.status(success ? 200 : 502).json({ result, error: success ? null : "Some items could not be published. Check the destination before retrying to avoid duplicates." });
  } catch (error) { return sendError(res, error); }
}
