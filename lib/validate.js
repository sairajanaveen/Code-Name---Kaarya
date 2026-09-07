import Ajv from "ajv";
import { AppError } from "./http.js";

export { MAX_TRANSCRIPT_LENGTH, cleanString, validEmail, validDate, assessNotes, validateMeetingPayload } from "./meetingInput.js";
import { validDate } from "./meetingInput.js";

const str = (maxLength) => ({ type: "string", maxLength });
const object = (properties) => ({ type: "object", properties, required: Object.keys(properties), additionalProperties: false });
export const outputSchema = object({
  summary: { ...str(12000), minLength: 1 }, language: str(40),
  minutes: { type: "array", maxItems: 2000, items: object({ topic: str(180), discussion: str(1800), outcome: str(600) }) },
  open_questions: { type: "array", maxItems: 2000, items: str(600) },
  readiness_score: { type: "integer", minimum: 0, maximum: 100 },
  decisions: { type: "array", items: str(600), maxItems: 2000 },
  blockers: { type: "array", items: str(600), maxItems: 2000 },
  action_items: { type: "array", maxItems: 2000, items: object({
    task: { ...str(260), minLength: 1 }, owner: str(120), team: str(120),
    due_date: str(10), priority: { type: "string", enum: ["Low", "Medium", "High"] },
    status: { type: "string", enum: ["pending", "in_progress", "blocked", "done"] }, evidence: str(700)
  }) },
  prep_questions: { type: "array", maxItems: 2000, items: object({
    question: { ...str(260), minLength: 1 }, intended_owner: str(120), reason: str(360), next_meeting_date: str(10)
  }) }
});
const validate = new Ajv({ allErrors: true }).compile(outputSchema);
export function validateStructuredOutput(result) {
  // Read previously saved reports without forcing a destructive history migration.
  if (result && typeof result === "object" && !Array.isArray(result)) {
    if (result.minutes === undefined) result.minutes = [];
    if (result.open_questions === undefined) result.open_questions = [];
  }
  if (!validate(result)) throw new AppError("The draft did not pass its format checks. Please try again.", 502, "INVALID_OUTPUT");
  if (result.action_items.some((item) => item.due_date && !validDate(item.due_date)) || result.prep_questions.some((item) => item.next_meeting_date && !validDate(item.next_meeting_date))) {
    throw new AppError("The draft contains an invalid date. Please try again.", 502, "INVALID_OUTPUT");
  }
  return result;
}

const normalized = (value) => String(value || "").normalize("NFC").replace(/[\u2018\u2019]/g, "'").replace(/[\u201c\u201d]/g, '"').replace(/\s+/g, " ").trim().toLowerCase();
const mentionsOwner = (source, owner) => new RegExp("(?:^|[^\\p{L}\\p{N}])" + normalized(owner).replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "(?:$|[^\\p{L}\\p{N}])", "u").test(source);

const confirmationQuestion = (kind, value) => {
  const prefix = kind === "decision" ? "Confirm whether this was decided: " : "Confirm whether this remains a blocker: ";
  return (prefix + String(value || "").trim()).slice(0, 600);
};

function groundStatements(items, field, kind, source, warnings, unconfirmed) {
  const output = [];
  const seen = new Set();
  for (const item of Array.isArray(items) ? items : []) {
    // Saved and manually reviewed records use strings. New model generations use
    // evidence-bearing objects and are reduced to the same stable storage shape.
    if (typeof item === "string") {
      const identity = normalized(item);
      if (identity && !seen.has(identity)) { seen.add(identity); output.push(item); }
      continue;
    }
    const value = String(item?.[field] || "").trim();
    const evidence = String(item?.evidence || "").trim();
    const identity = normalized(value);
    if (!value || !evidence || !source.includes(normalized(evidence))) {
      warnings.push("Some proposed " + kind + "s lacked verifiable source quotes and were not recorded as facts.");
      if (value && kind !== "open question") unconfirmed.push(confirmationQuestion(kind, value));
      continue;
    }
    if (!seen.has(identity)) { seen.add(identity); output.push(value); }
  }
  return output;
}

export function groundOutput(result, transcript, attendees = "", { allowUnconfirmed = false } = {}) {
  const source = normalized(transcript);
  const warnings = [];
  const unconfirmed = [];
  const groundedResult = {
    ...result,
    decisions: groundStatements(result?.decisions, "text", "decision", source, warnings, unconfirmed),
    blockers: groundStatements(result?.blockers, "text", "blocker", source, warnings, unconfirmed),
    open_questions: groundStatements(result?.open_questions, "question", "open question", source, warnings, unconfirmed)
  };
  validateStructuredOutput(groundedResult);
  const seen = new Set();
  const action_items = result.action_items.filter((item) => {
    if (!item.evidence.trim() || !source.includes(normalized(item.evidence))) {
      warnings.push("Some proposed actions need confirmation. They are listed under Open questions, not assigned as commitments.");
      unconfirmed.push("Confirm whether this was agreed: " + item.task);
      return false;
    }
    const key = [item.task, item.owner, item.team, item.due_date, item.priority, item.status].map(normalized).join("|");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).map((item) => {
    // Attendees can help the model spell a name, but only the action's source
    // quote proves ownership of that specific commitment.
    const owner = item.owner && mentionsOwner(normalized(item.evidence), item.owner) ? item.owner : "Unassigned";
    if (owner === "Unassigned") warnings.push("Some actions need an owner.");
    return { ...item, owner };
  });
  const readiness = action_items.length ? Math.round(action_items.reduce((sum, task) => sum + (task.owner !== "Unassigned" ? 1 : 0) + (task.due_date ? 1 : 0), 0) / (action_items.length * 2) * 100) : 0;
  if (!allowUnconfirmed && result.action_items.length && !action_items.length) throw new AppError("We could not verify the source quotes. No commitments were assigned.", 502, "UNGROUNDED_OUTPUT");
  const questions = new Set();
  const output = {
    structured: { ...groundedResult, open_questions: [...groundedResult.open_questions, ...unconfirmed], readiness_score: readiness, action_items, prep_questions: result.prep_questions.filter((item) => {
      const key = normalized(item.question);
      if (questions.has(key)) return false;
      questions.add(key);
      return true;
    }) },
    warnings: [...new Set(warnings)]
  };
  validateStructuredOutput(output.structured);
  return output;
}
