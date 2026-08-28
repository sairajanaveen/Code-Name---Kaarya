import { createHash } from "node:crypto";
import { supabaseFetch } from "./supabase.js";
import { AppError } from "./http.js";
import { prepareTranscript } from "./transcript.js";
import { transcriptSections, refinementSections, mergeSectionReports } from "./longTranscript.js";
import { extractAccountability } from "./aiPipeline.js";
import { validateStructuredOutput } from "./validate.js";
import { validUuid } from "./plans.js";
import { assessNotes } from "./meetingInput.js";

export const jobRpc = (name, args) => supabaseFetch("/rest/v1/rpc/kaarya_job_" + name, { method: "POST", body: JSON.stringify(args) });
export const digest = (value) => createHash("sha256").update(value).digest("hex");

export async function jobStatus(userId, jobId) {
  if (!validUuid(jobId)) throw new AppError("Upload not found.", 404);
  const [job] = await supabaseFetch(`/rest/v1/kaarya_transcript_jobs?id=eq.${jobId}&user_id=eq.${userId}&select=id,status,upload_count,section_count,expires_at,payload`);
  if (!job) throw new AppError("Upload not found in your workspace.", 404, "NOT_OWNER");
  const completed = job.status === "completed";
  const parts = completed ? [] : await supabaseFetch(`/rest/v1/kaarya_transcript_uploads?job_id=eq.${jobId}&select=position&order=position.asc&limit=66`);
  const sections = completed ? [] : await supabaseFetch(`/rest/v1/kaarya_transcript_sections?job_id=eq.${jobId}&result=not.is.null&select=position&limit=350`);
  return { id: job.id, status: job.status, title: job.payload.meeting_name, source_hash: job.payload.source_hash, kind: job.payload.kind || "generate", meeting_id: job.payload.meeting_id,
    uploaded: parts.map((part) => part.position), upload_count: job.upload_count, completed_sections: completed ? job.section_count : sections.length,
    total_sections: job.section_count, expires_at: job.expires_at };
}

export async function completedJob(userId, jobId) {
  const [request] = await supabaseFetch(`/rest/v1/kaarya_usage_requests?id=eq.${jobId}&user_id=eq.${userId}&status=eq.completed&select=result`);
  if (!request?.result) throw new AppError("This result is no longer available. Check your meeting history.", 410, "REQUEST_DELETED");
  return request.result;
}

export async function processJobStep(userId, jobId, extract = extractAccountability) {
  const args = { p_user: userId, p_job: jobId };
  const claim = await jobRpc("claim", args);
  if (claim.status === "completed") return { done: true, data: await completedJob(userId, jobId) };
  try {
    if (claim.status === "preparing") {
      if (digest(claim.raw_notes) !== claim.payload.source_hash) throw new AppError("The uploaded text did not match the original. Start a fresh upload; no sections were processed.", 400, "UPLOAD_MISMATCH");
      const issue = assessNotes(claim.raw_notes);
      if (issue) throw new AppError(issue, 400, "WEAK_TRANSCRIPT");
      const prepared = await prepareTranscript(claim.raw_notes, { tolerant: true });
      const sections = refinementSections(transcriptSections(prepared.text), claim.payload.structured);
      await jobRpc("prepare", { ...args, p_lease: claim.lease, p_sections: sections, p_warnings: prepared.warnings || [] });
      return { done: false, stage: "extracting", completed_sections: 0, total_sections: sections.length };
    }
    if (claim.status === "processing") {
      const result = await extract({ payload: { ...claim.payload, raw_notes: claim.content },
        instruction: claim.payload.instruction || "", previous: claim.previous || null, section: { number: claim.position + 1, total: claim.total, overlapping_context: true } });
      await jobRpc("checkpoint", { ...args, p_lease: claim.lease, p_position: claim.position, p_result: result });
      return { done: false, stage: "extracting", completed_sections: claim.position + 1, total_sections: claim.total };
    }
    const result = mergeSectionReports(claim.results);
    result.warnings = [...new Set([...(claim.warnings || []), ...result.warnings])];
    if (claim.payload.kind === "refine") result.warnings.push("Review all changes before saving. The previous saved review is unchanged until you save this draft.");
    validateStructuredOutput(result.structured);
    if (Buffer.byteLength(JSON.stringify(result)) > 2500000) throw new AppError("The detailed report is too large to deliver in one response. The processed sections are saved; contact support to export them.", 422, "REPORT_TOO_LARGE");
    const data = await jobRpc("finish", { ...args, p_lease: claim.lease, p_result: result });
    return { done: true, data };
  } catch (error) {
    await jobRpc("release", { ...args, p_lease: claim.lease }).catch(() => {});
    throw error;
  }
}
