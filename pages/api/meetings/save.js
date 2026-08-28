import { requireUser } from "../../../lib/auth.js";
import { validateStructuredOutput, validDate, MAX_TRANSCRIPT_LENGTH } from "../../../lib/validate.js";
import { saveReviewedDraft, consumeQuota, getOwnedMeeting } from "../../../lib/supabase.js";
import { AppError, sendError } from "../../../lib/http.js";

export const config = { api: { bodyParser: { sizeLimit: "3mb" }, responseLimit: false } };
const uuid = (value) => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
export default async function handler(req, res) {
  if (req.method !== "POST") { res.setHeader("Allow", "POST"); return res.status(405).json({ error: "Method not allowed" }); }
  res.setHeader("Cache-Control", "no-store");
  try {
    const user = await requireUser(req);
    const { meeting, structured, action_ids: actionIds, revision = 0, save_id: saveId, source_notes: notes = null } = req.body || {};
    validateStructuredOutput(structured);
    if (!uuid(meeting?.id) || !uuid(saveId) || !validDate(meeting?.meeting_date) || typeof meeting?.title !== "string" || !meeting.title.trim() || meeting.title.length > 180) throw new AppError("Check the meeting name and date before saving.", 400);
    if (!Array.isArray(actionIds) || actionIds.length !== structured.action_items.length || !actionIds.every(uuid) || new Set(actionIds).size !== actionIds.length || !Number.isInteger(revision) || revision < 0) throw new AppError("The draft could not be saved. Please reopen it.", 400);
    if (notes !== null && (typeof notes !== "string" || notes.length > MAX_TRANSCRIPT_LENGTH + 12000)) throw new AppError("The source notes are too long.", 400);
    if (notes === null) await getOwnedMeeting(meeting.id, user.id);
    await consumeQuota(user.id, "save", 60);
    const saved = await saveReviewedDraft({ userId: user.id, meeting, structured, actionIds, revision, saveId, notes });
    const { source_notes, output_snapshot, ...metadata } = saved.meeting;
    return res.status(200).json({ ...saved, meeting: metadata });
  } catch (error) { return sendError(res, error); }
}
