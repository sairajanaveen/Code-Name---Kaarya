import { requireUser } from "../../../lib/auth.js";
import { consumeQuota, getOwnedMeeting, listTasks, supabaseFetch } from "../../../lib/supabase.js";
import { AppError, sendError } from "../../../lib/http.js";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (!["GET", "DELETE"].includes(req.method)) { res.setHeader("Allow", "GET, DELETE"); return res.status(405).end(); }
  try {
    const user = await requireUser(req);
    const meeting = await getOwnedMeeting(req.query.id, user.id);
    if (req.method === "DELETE") {
      if (req.headers["x-kaarya-confirm-delete"] !== meeting.id) throw new AppError("Confirm which meeting to delete.", 400);
      await consumeQuota(user.id, "delete", 20);
      await supabaseFetch("/rest/v1/rpc/kaarya_delete_meeting", { method: "POST", body: JSON.stringify({ p_user: user.id, p_meeting: meeting.id }) });
      return res.status(200).json({ deleted: true });
    }
    await consumeQuota(user.id, "export", 60);
    const tasks = (await listTasks(user.id, meeting.id)).map(({ update_token, meetings, ...task }) => task);
    const { created_by, last_save_id, organization_id, ...record } = meeting;
    if (record.status === "reviewed" && record.output_snapshot) record.output_snapshot = { ...record.output_snapshot, action_items: tasks };
    res.setHeader("Content-Disposition", 'attachment; filename="kaarya-meeting.json"');
    return res.status(200).json({ exported_at: new Date().toISOString(), meeting: record, tasks });
  } catch (error) { return sendError(res, error); }
}
