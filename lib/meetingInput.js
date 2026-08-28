// Transport/storage guard, not a model context or plan-specific character allowance.
export const MAX_TRANSCRIPT_BYTES = 8 * 1024 * 1024;
export const MAX_TRANSCRIPT_LENGTH = MAX_TRANSCRIPT_BYTES;
export const DIRECT_TRANSCRIPT_LENGTH = 40000;
export const transcriptBytes = (value) => new TextEncoder().encode(value).byteLength;
export const cleanString = (value, maxLength = 4000) => typeof value === "string" ? value.trim().slice(0, maxLength) : "";
export const validEmail = (value) => typeof value === "string" && value.length <= 254 && /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(value);
export function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) return false;
  const date = new Date(value + "T00:00:00Z");
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function assessNotes(value = "") {
  const text = typeof value === "string" ? value.trim() : "";
  const words = text.match(/[\p{L}\p{N}][\p{L}\p{M}\p{N}'-]*/gu) || [];
  const unique = new Set(words.map((word) => word.toLowerCase()));
  if (text.length > MAX_TRANSCRIPT_LENGTH || transcriptBytes(text) > MAX_TRANSCRIPT_BYTES) return "This text exceeds the 8 MiB upload safety limit. Nothing was truncated. Import one meeting at a time.";
  if (text.length < 12 || words.length < 3 || unique.size < 3) return "Add the discussion, a decision, or a next step. Even a short meeting note is enough.";
  if (words.length > 20 && unique.size < 8) return "These notes look repetitive. Add the actual meeting discussion or decisions.";
  return "";
}

export function validateMeetingPayload(input = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return { ok: false, errors: ["Meeting details are required."] };
  const notes = typeof input.raw_notes === "string" ? input.raw_notes.trim() : "";
  const payload = {
    source: ["website", "tally", "upload", "transcript_import"].includes(input.source) ? input.source : "website",
    meeting_name: cleanString(input.meeting_name, 180) || "Meeting notes",
    meeting_date: cleanString(input.meeting_date, 40) || new Date().toISOString().slice(0, 10),
    attendees: cleanString(input.attendees, 1200), agenda: cleanString(input.agenda, 2000),
    raw_notes: notes, email: cleanString(input.email, 254).toLowerCase(),
    language_hint: cleanString(input.language_hint, 40),
    output_focus: ["actions", "decisions", "prep"].includes(input.output_focus) ? input.output_focus : "actions",
    review_before_send: input.review_before_send !== false,
    destination_channels: Array.isArray(input.destination_channels)
      ? [...new Set(input.destination_channels.filter((channel) => ["email", "dashboard", "notion", "teams", "slack"].includes(channel)))]
      : ["dashboard"]
  };
  const errors = [];
  if (!validDate(payload.meeting_date)) errors.push("Choose a valid meeting date.");
  if (payload.email && !validEmail(payload.email)) errors.push("Enter a valid email address.");
  const noteError = assessNotes(notes);
  if (noteError) errors.push(noteError);
  if (!notes && (input.audio_url || input.attachment_url)) errors.push("Transcribe the recording or import the text before creating action items.");
  return { ok: !errors.length, payload, errors };
}
