import { integrationStatus } from "../../../lib/config.js";
import { requireUser } from "../../../lib/auth.js";
import { listMeetings } from "../../../lib/supabase.js";
import { AppError, sendError } from "../../../lib/http.js";
export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET") { res.setHeader("Allow", "GET"); return res.status(405).end(); }
  try {
    const user = await requireUser(req);
    const offset = Number(req.query?.offset || 0);
    if (!Number.isInteger(offset) || offset < 0 || offset > 100000) throw new AppError("Invalid history page.", 400);
    const meetings = await listMeetings(user.id, offset);
    return res.status(200).json({ meetings, next_offset: meetings.length === 30 ? offset + 30 : null, integrations: integrationStatus() });
  }
  catch(error) { return sendError(res, error); }
}
