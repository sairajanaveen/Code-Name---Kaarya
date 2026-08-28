import { uploadParts } from "./longTranscript.js";

export async function runTranscriptJob({ payload, requestId, resumeId, refinement, request, signal, onProgress = () => {} }) {
  const parts = refinement ? [] : uploadParts(payload.raw_notes || "");
  const hash = refinement ? "" : Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(payload.raw_notes || "")))).map((n) => n.toString(16).padStart(2, "0")).join("");
  const { raw_notes, ...metadata } = payload;
  let job = resumeId ? await request("/api/meetings/jobs/" + resumeId, null, "GET", signal)
    : await request("/api/meetings/jobs", refinement ? { ...refinement, request_id: requestId, kind: "refine" } : { request_id: requestId, payload: metadata, source_hash: hash, parts: parts.length }, "POST", signal);
  const url = "/api/meetings/jobs/" + job.id;
  if (job.status === "uploading") {
    if (job.source_hash !== hash) throw new Error("Re-import the same transcript to finish its upload. Completed parts are already saved.");
    const uploaded = new Set(job.uploaded);
    for (let index = 0; index < parts.length; index++) {
      if (signal?.aborted) throw new DOMException("Paused", "AbortError");
      onProgress({ ...job, stage: "uploading", completed: uploaded.size, total: parts.length });
      if (!uploaded.has(index)) { await request(url, { position: index, content: parts[index] }, "PUT", signal); uploaded.add(index); }
    }
  }
  for (;;) {
    if (signal?.aborted) throw new DOMException("Paused", "AbortError");
    onProgress({ ...job, stage: job.total_sections ? "extracting" : "reading" });
    const step = await request(url, {}, "POST", signal);
    if (step.done) return step.data;
    job = { ...job, ...step, status: "processing" };
    onProgress(job);
  }
}
