import Ajv from "ajv";
import { AppError } from "./http.js";

export { MAX_TRANSCRIPT_LENGTH, cleanString, validEmail, validDate, assessNotes, validateMeetingPayload } from "./meetingInput.js";
import { validDate } from "./meetingInput.js";

const str = (maxLength) => ({ type: "string", maxLength });
const object = (properties) => ({ type: "object", properties, required: Object.keys(properties), additionalProperties: false });
export const outputSchema = object({
  summary: { ...str(900), minLength: 1 }, language: str(40),
  readiness_score: { type: "integer", minimum: 0, maximum: 100 },
  decisions: { type: "array", items: str(300), maxItems: 12 },
  blockers: { type: "array", items: str(300), maxItems: 12 },
  action_items: { type: "array", maxItems: 24, items: object({
    task: { ...str(260), minLength: 1 }, owner: str(120), team: str(120),
    due_date: str(10), priority: { type: "string", enum: ["Low", "Medium", "High"] },
    status: { type: "string", enum: ["pending", "in_progress", "blocked", "done"] }, evidence: str(700)
  }) },
  prep_questions: { type: "array", maxItems: 5, items: object({
    question: { ...str(260), minLength: 1 }, intended_owner: str(120), reason: str(360), next_meeting_date: str(10)
  }) }
});
const validate = new Ajv({ allErrors: true }).compile(outputSchema);
export function validateStructuredOutput(result) {
  if (!validate(result)) throw new AppError("The draft did not pass its format checks. Please try again.", 502, "INVALID_OUTPUT");
  if (result.action_items.some((item) => item.due_date && !validDate(item.due_date)) || result.prep_questions.some((item) => item.next_meeting_date && !validDate(item.next_meeting_date))) {
    throw new AppError("The draft contains an invalid date. Please try again.", 502, "INVALID_OUTPUT");
  }
  return result;
}

const normalized = (value) => String(value || "").normalize("NFC").replace(/\s+/g, " ").trim().toLowerCase();
export function groundOutput(result, transcript, attendees = "") {
  validateStructuredOutput(result);
  const source = normalized(transcript);
  const people = source + " " + normalized(attendees);
  const seen = new Set();
  const warnings = [];
  const action_items = result.action_items.filter((item) => {
    if (!item.evidence.trim() || !source.includes(normalized(item.evidence))) {
      warnings.push("An action without a matching source quote was removed. Review the notes for anything missing.");
      return false;
    }
    const key = normalized(item.task) + "|" + normalized(item.owner);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).map((item) => {
    const owner = item.owner && people.includes(normalized(item.owner)) ? item.owner : "Unassigned";
    if (owner === "Unassigned") warnings.push("Some actions need an owner.");
    return { ...item, owner };
  });
  if (result.action_items.length && !action_items.length) throw new AppError("We could not verify the proposed actions against your notes. Please retry or add clearer context.", 502, "UNGROUNDED_OUTPUT");
  const readiness = action_items.length ? Math.round(action_items.reduce((sum, task) => sum + (task.owner !== "Unassigned" ? 1 : 0) + (task.due_date ? 1 : 0), 0) / (action_items.length * 2) * 100) : 0;
  const questions = new Set();
  return {
    structured: { ...result, readiness_score: readiness, action_items, prep_questions: result.prep_questions.filter((item) => {
      const key = normalized(item.question);
      if (questions.has(key)) return false;
      questions.add(key);
      return true;
    }) },
    warnings: [...new Set(warnings)]
  };
}
