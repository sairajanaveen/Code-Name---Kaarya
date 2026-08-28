import { requireUser } from "../../lib/auth.js";
import { accountOverview, updateProfile } from "../../lib/account.js";
import { consumeQuota } from "../../lib/supabase.js";
import { sendError } from "../../lib/http.js";

export const config = { api: { bodyParser: { sizeLimit: "8kb" } } };
export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (!["GET", "PATCH"].includes(req.method)) { res.setHeader("Allow", "GET, PATCH"); return res.status(405).end(); }
  try {
    const user = await requireUser(req);
    const account = await accountOverview(user);
    if (req.method === "PATCH") {
      await consumeQuota(user.id, "profile", 30);
      account.profile = await updateProfile(user.id, req.body);
    }
    return res.status(200).json(account);
  } catch (error) { return sendError(res, error); }
}
