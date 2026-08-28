import { randomUUID } from "node:crypto";
import { requireUser } from "../../../../lib/auth.js";
import { config as appConfig } from "../../../../lib/config.js";
import { AppError, sendError } from "../../../../lib/http.js";
import { validateMeetingPayload } from "../../../../lib/meetingInput.js";
import { validateStructuredOutput } from "../../../../lib/validate.js";
import { validUuid } from "../../../../lib/plans.js";
import { consumeQuota, supabaseFetch, getOwnedMeeting } from "../../../../lib/supabase.js";
import { digest, jobRpc, jobStatus } from "../../../../lib/transcriptJobs.js";
import { uploadParts, MAX_UPLOAD_PARTS } from "../../../../lib/longTranscript.js";

export const config = { api: { bodyParser: { sizeLimit: "3mb" } } };
export const maxDuration = 60;
export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  try {
    const user = await requireUser(req);
    if (req.method === "GET") {
      const jobs = await supabaseFetch(`/rest/v1/kaarya_transcript_jobs?user_id=eq.${user.id}&status=not.in.(completed,cancelled)&expires_at=gt.${encodeURIComponent(new Date().toISOString())}&select=id&order=created_at.desc&limit=1`);
      return res.json({ job: jobs[0] ? await jobStatus(user.id, jobs[0].id) : null });
    }
    if (req.method !== "POST") { res.setHeader("Allow", "GET, POST"); return res.status(405).json({ error: "Method not allowed" }); }
    if (!appConfig.llmApiKey && !appConfig.openaiApiKey) throw new AppError("AI processing is not configured. Your notes have not been uploaded.", 503, "AI_NOT_CONFIGURED");
    const body = req.body || {};
    const id = body.request_id || randomUUID();
    if (!validUuid(id)) throw new AppError("Start a fresh upload.", 400);
    const isRefine = body.kind === "refine";
    let sourceHash = body.source_hash;
    let partCount = body.parts;
    let source;
    let payloadInput = body.payload;
    if (isRefine) {
      const meeting = await getOwnedMeeting(body.meeting_id, user.id);
      if (typeof body.instruction !== "string" || !body.instruction.trim() || body.instruction.length > 2000) throw new AppError("Enter a correction of 1 to 2,000 characters.", 400);
      validateStructuredOutput(body.structured);
      source = meeting.source_notes || "";
      if (!source) throw new AppError("This meeting has no source notes available for refinement.", 409);
      sourceHash = digest(source); partCount = uploadParts(source).length;
      payloadInput = { meeting_name: meeting.title, meeting_date: meeting.meeting_date };
    }
    if (!/^[a-f0-9]{64}$/.test(sourceHash || "") || !Number.isInteger(partCount) || partCount < 1 || partCount > MAX_UPLOAD_PARTS) throw new AppError("The upload details are incomplete. Please retry.", 400);
    const validation = validateMeetingPayload({ ...payloadInput, raw_notes: "Meeting notes will be uploaded securely in parts." });
    if (!validation.ok) throw new AppError(validation.errors.join(" "), 400);
    const { raw_notes, ...metadata } = validation.payload;
    const payload = { ...metadata, source_hash: sourceHash, kind: isRefine ? "refine" : "generate", ...(isRefine ? { instruction: body.instruction.trim(), structured: body.structured, meeting_id: body.meeting_id } : {}) };
    await consumeQuota(user.id, "job_create", 6);
    await jobRpc("create", { p_user: user.id, p_job: id, p_payload: payload, p_hash: digest(JSON.stringify({ payload, partCount })), p_parts: partCount });
    if (isRefine) await jobRpc("seed", { p_user: user.id, p_job: id, p_meeting: body.meeting_id });
    return res.status(201).json(await jobStatus(user.id, id));
  } catch (error) { return sendError(res, error); }
}
