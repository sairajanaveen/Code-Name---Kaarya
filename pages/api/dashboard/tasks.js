import { requireUser } from "../../../lib/auth.js";
import { listTasks, listPrepQuestions, listDeliveryLogs, getOwnedMeeting } from "../../../lib/supabase.js";
import { sendError } from "../../../lib/http.js";
export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET") { res.setHeader("Allow", "GET"); return res.status(405).end(); }
  try {
    const user = await requireUser(req);
    if (req.query?.meeting_id) {
      const meeting = await getOwnedMeeting(req.query.meeting_id, user.id);
      const tasks = await listTasks(user.id, meeting.id);
      return res.status(200).json({ meeting, tasks });
    }
    const [tasks, prep, logs] = await Promise.all([listTasks(user.id), listPrepQuestions(user.id), listDeliveryLogs(user.id)]);
    return res.status(200).json({ tasks: tasks?.skipped ? [] : tasks, prep_questions: prep?.skipped ? [] : prep, delivery_logs: logs?.skipped ? [] : logs });
  }
  catch(error) { return sendError(res, error); }
}
