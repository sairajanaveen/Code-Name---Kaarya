import { requireUser } from "../../../../lib/auth.js";
import { validUuid } from "../../../../lib/plans.js";
import { AppError, sendError } from "../../../../lib/http.js";
import { supabaseFetch } from "../../../../lib/supabase.js";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET") { res.setHeader("Allow", "GET"); return res.status(405).end(); }
  try {
    const user = await requireUser(req);
    const offset = Number(req.query.offset || 0);
    if (!validUuid(req.query.id) || !Number.isSafeInteger(offset) || offset < 0 || offset > 8388608) throw new AppError("Invalid source request.", 400);
    return res.json(await supabaseFetch("/rest/v1/rpc/kaarya_source_part", { method: "POST", body: JSON.stringify({ p_user: user.id, p_meeting: req.query.id, p_offset: offset }) }));
  } catch (error) { return sendError(res, error); }
}
