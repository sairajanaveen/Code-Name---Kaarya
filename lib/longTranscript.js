import { DIRECT_TRANSCRIPT_LENGTH, MAX_TRANSCRIPT_BYTES, transcriptBytes } from "./meetingInput.js";
import { AppError } from "./http.js";

export const UPLOAD_PART_LENGTH = 128000;
export const MAX_UPLOAD_PARTS = 66;

export function uploadParts(text) {
  if (transcriptBytes(text) > MAX_TRANSCRIPT_BYTES) throw new AppError("The transcript exceeds the 8 MiB safety limit.", 400, "INPUT_LIMIT");
  const parts = [];
  for (let start = 0; start < text.length;) {
    let end = Math.min(start + UPLOAD_PART_LENGTH, text.length);
    if (end < text.length && /[\uD800-\uDBFF]/.test(text[end - 1])) end--;
    parts.push(text.slice(start, end)); start = end;
  }
  return parts;
}

export function transcriptSections(text, limit = DIRECT_TRANSCRIPT_LENGTH, overlap = 1800) {
  if (limit < 100 || overlap < 0 || overlap >= limit / 2) throw new Error("Invalid section size");
  const sections = [];
  let start = 0;
  while (start < text.length) {
    let end = Math.min(start + limit, text.length);
    if (end < text.length) {
      const boundary = Math.max(text.lastIndexOf("\n", end - 1), text.lastIndexOf(". ", end - 1), text.lastIndexOf(" ", end - 1));
      if (boundary > start + limit * 0.7) end = boundary + 1;
      if (/[\uD800-\uDBFF]/.test(text[end - 1])) end--;
    }
    sections.push({ text: text.slice(start, end), start, end });
    if (end === text.length) break;
    start = end - overlap;
    if (/[\uDC00-\uDFFF]/.test(text[start])) start--;
  }
  return sections;
}

const key = (value) => String(value).normalize("NFC").replace(/\s+/g, " ").trim().toLowerCase();
const unique = (items, identity = key) => [...new Map(items.map((item) => [identity(item), item])).values()];

export function refinementSections(sections, previous) {
  if (!previous) return sections;
  const source = sections.map((section) => key(section.text));
  const contexts = sections.map((_, index) => ({ ...previous, summary: index === 0 ? previous.summary : "",
    action_items: [], minutes: [], decisions: [], blockers: [], open_questions: [], prep_questions: [] }));
  // Each existing row is supplied once. Rows without a literal source match belong to the first section, not the discard pile.
  for (const field of ["action_items", "minutes", "decisions", "blockers", "open_questions", "prep_questions"]) {
    for (const row of previous[field] || []) {
      const quote = key(typeof row === "string" ? row : row.evidence || row.topic || row.question);
      const position = quote ? source.findIndex((text) => text.includes(quote)) : -1;
      contexts[Math.max(0, position)][field].push(row);
    }
  }
  return sections.map((section, index) => ({ ...section, previous: contexts[index] }));
}

export function mergeSectionReports(reports) {
  if (!reports.length || reports.some((report) => !report?.structured)) throw new AppError("Some sections are not ready yet. Resume processing to finish the meeting.", 409, "INCOMPLETE_REPORT");
  const outputs = reports.map((report) => report.structured);
  // Exact duplicates from overlap are collapsed; conflicting commitments are never silently resolved.
  const action_items = unique(outputs.flatMap((o) => o.action_items), (task) => key([task.task, task.owner, task.team, task.due_date, task.priority, task.status].join("|")));
  const warnings = unique(reports.flatMap((r) => r.warnings || []));
  const byTask = new Map();
  for (const task of action_items) {
    const id = key(task.task);
    const previous = byTask.get(id);
    if (previous && (previous.owner !== task.owner || previous.due_date !== task.due_date || previous.status !== task.status)) warnings.push("Different owners, dates or statuses appear for the same action. Review the source quotes before sharing.");
    byTask.set(id, task);
  }
  const summaries = unique(outputs.map((o) => o.summary));
  const minutes = unique(outputs.flatMap((o) => o.minutes?.length ? o.minutes : [{ topic: "Discussion", discussion: o.summary, outcome: "" }]), (row) => key(row.topic + "|" + row.discussion + "|" + row.outcome));
  const fullSummary = summaries.join("\n\n");
  // Every section summary remains in the minutes even when the overview must stay scannable.
  if (fullSummary.length > 12000) for (const [index, summary] of summaries.entries()) {
    if (!minutes.some((row) => row.discussion === summary)) minutes.push({ topic: "Section " + (index + 1) + " overview", discussion: summary, outcome: "" });
  }
  const structured = {
    summary: fullSummary.length <= 12000 ? fullSummary : "This meeting covers " + reports.length + " transcript sections. The complete discussion record is organized by topic below, with " + action_items.length + " source-linked actions.",
    language: outputs[0].language, readiness_score: action_items.length ? Math.round(action_items.reduce((sum, task) => sum + (task.owner && task.owner !== "Unassigned" ? 1 : 0) + (task.due_date ? 1 : 0), 0) / (action_items.length * 2) * 100) : 0,
    minutes, action_items,
    decisions: unique(outputs.flatMap((o) => o.decisions)), blockers: unique(outputs.flatMap((o) => o.blockers)),
    open_questions: unique(outputs.flatMap((o) => o.open_questions || [])),
    prep_questions: unique(outputs.flatMap((o) => o.prep_questions), (q) => key(q.question))
  };
  return { structured, warnings: unique(warnings), processing: { sections: reports.length, duration_ms: reports.reduce((sum, r) => sum + (r.processing?.duration_ms || 0), 0), attempts: reports.flatMap((r) => r.processing?.attempts || []) } };
}
