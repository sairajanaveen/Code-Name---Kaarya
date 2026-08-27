import { requireUser } from "../../lib/auth.js";
import { extractAccountability } from "../../lib/aiPipeline.js";
import { validateMeetingPayload, validateStructuredOutput } from "../../lib/validate.js";
import { consumeQuota } from "../../lib/supabase.js";
import { AppError, sendError } from "../../lib/http.js";

export const config = { api: { bodyParser: { sizeLimit: "512kb" } } };
export const maxDuration = 60;
export default async function handler(req, res) {
  if (req.method !== "POST") { res.setHeader("Allow", "POST"); return res.status(405).json({ error: "Method not allowed" }); }
  res.setHeader("Cache-Control", "no-store");
  try {
    const user = await requireUser(req);
    const { instruction, structured, payload: input } = req.body || {};
    if (typeof instruction !== "string" || !instruction.trim() || instruction.length > 2000) throw new AppError("Enter a correction of 1 to 2,000 characters.", 400);
    validateStructuredOutput(structured);
    const { ok, payload, errors } = validateMeetingPayload(input);
    if (!ok) throw new AppError(errors.join(" "), 400);
    await consumeQuota(user.id, "extract", 12);
    return res.status(200).json(await extractAccountability({ payload, instruction: instruction.trim(), previous: structured }));
  } catch (error) { return sendError(res, error); }
}
