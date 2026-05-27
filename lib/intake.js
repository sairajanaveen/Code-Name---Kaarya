import { cleanString } from "./validate.js";

const aliases = {
  meeting_name: ["meeting_name", "meeting name", "meeting", "title", "name"],
  meeting_date: ["meeting_date", "meeting date", "date"],
  attendees: ["attendees", "participants", "accountable parties", "people", "team members"],
  agenda: ["agenda", "meeting agenda"],
  raw_notes: ["raw_notes", "raw notes", "notes", "transcript", "mom", "minutes", "meeting notes"],
  email: ["email", "work email", "your email", "recipient email", "where should we send the action report"],
  language_hint: ["language_hint", "language", "language hint"]
};

function normalizeKey(key) {
  return String(key || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function findValue(flat, target) {
  const possible = aliases[target] || [target];
  const normalized = Object.entries(flat).reduce((acc, [key, value]) => {
    acc[normalizeKey(key)] = value;
    return acc;
  }, {});

  for (const alias of possible) {
    const exact = normalized[normalizeKey(alias)];
    if (exact !== undefined && exact !== null && exact !== "") return exact;
  }

  for (const [key, value] of Object.entries(normalized)) {
    if (possible.some((alias) => key.includes(normalizeKey(alias)))) {
      if (value !== undefined && value !== null && value !== "") return value;
    }
  }

  return "";
}

function flattenTallyFields(input) {
  const flat = {};
  const fields = input?.data?.fields || input?.fields || input?.answers || [];

  if (Array.isArray(fields)) {
    fields.forEach((field) => {
      const label = field.label || field.title || field.name || field.question || field.key || field.id;
      const value = field.value ?? field.answer ?? field.text ?? field.email ?? "";
      if (label) flat[label] = Array.isArray(value) ? value.join(", ") : value;
      if (field.id) flat[field.id] = Array.isArray(value) ? value.join(", ") : value;
      if (field.key) flat[field.key] = Array.isArray(value) ? value.join(", ") : value;
    });
  } else if (fields && typeof fields === "object") {
    Object.assign(flat, fields);
  }

  Object.assign(flat, input);
  return flat;
}

export function normalizeIntakePayload(input = {}) {
  const flat = flattenTallyFields(input);
  const isTally = Boolean(input.formId || input.form_id || input.responseId || input.response_id || input.data?.fields);
  const meetingDate = cleanString(input.meeting_date || findValue(flat, "meeting_date"), 40);

  return {
    source: input.source || (isTally ? "tally" : "website"),
    meeting_name: cleanString(input.meeting_name || findValue(flat, "meeting_name"), 180),
    meeting_date: meetingDate || new Date().toISOString().split("T")[0],
    attendees: cleanString(input.attendees || findValue(flat, "attendees"), 1200),
    agenda: cleanString(input.agenda || findValue(flat, "agenda"), 2000),
    raw_notes: cleanString(input.raw_notes || findValue(flat, "raw_notes"), 24000),
    email: cleanString(input.email || findValue(flat, "email"), 240),
    language_hint: cleanString(input.language_hint || findValue(flat, "language_hint"), 40),
    audio_url: cleanString(input.audio_url, 1000),
    attachment_url: cleanString(input.attachment_url, 1000),
    destination_channels: input.destination_channels || ["email", "dashboard", "notion", "teams", "slack"]
  };
}
