import { createHash } from "node:crypto";
import { requireUser } from "../../../lib/auth.js";
import { sendDirectEmail } from "../../../lib/email.js";
import { getOwnedMeeting, consumeQuota, saveDeliveryLogs } from "../../../lib/supabase.js";
import { AppError, sendError } from "../../../lib/http.js";
export const maxDuration = 60;
export default async function handler(req, res) {
  if (req.method !== "POST") { res.setHeader("Allow", "POST"); return res.status(405).json({ error: "Method not allowed" }); }
  res.setHeader("Cache-Control", "no-store");
  try {
    const user = await requireUser(req);
    const { to, subject, text, meeting_id, scheduled_at } = req.body || {};
    await getOwnedMeeting(meeting_id, user.id);
    if (typeof subject !== "string" || !subject.trim() || subject.length > 200 || /[\r\n]/.test(subject) || typeof text !== "string" || !text.trim() || text.length > 30000) throw new AppError("Check the email subject and message before sending.", 400);
    let scheduledAt;
    if (scheduled_at) {
      const timestamp = Date.parse(scheduled_at);
      if (!Number.isFinite(timestamp) || timestamp < Date.now() + 60000 || timestamp > Date.now() + 30 * 86400000) throw new AppError("Choose a time from one minute to 30 days from now.", 400);
      scheduledAt = new Date(timestamp).toISOString();
    }
    await consumeQuota(user.id, "email", 20);
    const idempotencyKey = createHash("sha256").update(JSON.stringify({ user: user.id, to, subject, text, meeting_id, scheduledAt })).digest("hex");
    const result = await sendDirectEmail({ to, subject, text, scheduledAt, idempotencyKey });
    if (!result.ok) throw new AppError(result.error, result.status || 502);
    let warning;
    try { await saveDeliveryLogs({ meetingId: meeting_id, results: { email: result }, payload: { email: Array.isArray(to) ? to.join(", ") : to } }); }
    catch { warning = "The provider accepted the email, but its dashboard log could not be saved."; }
    return res.status(200).json({ result, warning, status: scheduledAt ? "scheduled" : "accepted" });
  } catch (error) { return sendError(res, error); }
}
