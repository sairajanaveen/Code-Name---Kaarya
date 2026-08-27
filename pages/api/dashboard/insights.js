import { requireUser } from "../../../lib/auth.js";
import { listMeetings, listTasks } from "../../../lib/supabase.js";
import { buildHistoricalInsights } from "../../../lib/scoring.js";
import { sendError } from "../../../lib/http.js";
export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET") { res.setHeader("Allow", "GET"); return res.status(405).end(); }
  try { const user = await requireUser(req); const [meetings, tasks] = await Promise.all([listMeetings(user.id), listTasks(user.id)]); return res.status(200).json({ insights: buildHistoricalInsights({ meetings: meetings?.skipped ? [] : meetings, tasks: tasks?.skipped ? [] : tasks }) }); }
  catch(error) { return sendError(res, error); }
}
