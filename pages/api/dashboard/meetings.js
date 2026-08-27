import { integrationStatus } from "../../../lib/config.js";
import { requireUser } from "../../../lib/auth.js";
import { listMeetings } from "../../../lib/supabase.js";
import { sendError } from "../../../lib/http.js";
export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET") { res.setHeader("Allow", "GET"); return res.status(405).end(); }
  try { const user = await requireUser(req); const meetings = await listMeetings(user.id); return res.status(200).json({ meetings: meetings?.skipped ? [] : meetings, integrations: integrationStatus() }); }
  catch(error) { return sendError(res, error); }
}
