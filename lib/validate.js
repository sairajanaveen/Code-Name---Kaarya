const allowedSources = new Set(["website", "tally", "upload", "transcript_import"]);
const allowedChannels = new Set(["email", "dashboard", "notion", "teams", "slack"]);

export function cleanString(value, maxLength = 4000) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

export function validateMeetingPayload(input = {}) {
  const destinationChannels = Array.isArray(input.destination_channels)
    ? input.destination_channels.filter((channel) => allowedChannels.has(channel))
    : ["email", "dashboard", "notion"];

  const payload = {
    source: allowedSources.has(input.source) ? input.source : "website",
    meeting_name: cleanString(input.meeting_name, 180),
    meeting_date: cleanString(input.meeting_date, 40),
    attendees: cleanString(input.attendees, 1200),
    agenda: cleanString(input.agenda, 2000),
    raw_notes: cleanString(input.raw_notes, 24000),
    email: cleanString(input.email, 240).toLowerCase(),
    language_hint: cleanString(input.language_hint, 40),
    audio_url: cleanString(input.audio_url, 1000),
    attachment_url: cleanString(input.attachment_url, 1000),
    destination_channels: destinationChannels.length ? destinationChannels : ["email", "dashboard"]
  };

  const errors = [];
  if (!payload.meeting_name) errors.push("meeting_name is required");
  if (!payload.meeting_date) errors.push("meeting_date is required");
  if (!payload.email || !payload.email.includes("@")) errors.push("valid email is required");
  if (!payload.raw_notes && !payload.audio_url && !payload.attachment_url) {
    errors.push("raw_notes, audio_url, or attachment_url is required");
  }

  return { ok: errors.length === 0, payload, errors };
}

export function validateStructuredOutput(result = {}) {
  const actionItems = Array.isArray(result.action_items) ? result.action_items : [];
  const prepQuestions = Array.isArray(result.prep_questions) ? result.prep_questions : [];
  const rawScore = Number(result.readiness_score);
  const normalizedScore = Number.isFinite(rawScore)
    ? Math.round(rawScore <= 1 ? rawScore * 100 : rawScore)
    : 50;

  return {
    summary: cleanString(result.summary, 1200),
    language: cleanString(result.language, 40) || "unknown",
    readiness_score: Math.max(0, Math.min(100, normalizedScore)),
    decisions: Array.isArray(result.decisions) ? result.decisions.map((item) => cleanString(item, 240)).filter(Boolean) : [],
    blockers: Array.isArray(result.blockers) ? result.blockers.map((item) => cleanString(item, 240)).filter(Boolean) : [],
    action_items: actionItems.slice(0, 24).map((item) => ({
      task: cleanString(item.task, 260),
      owner: cleanString(item.owner, 120) || "Unassigned",
      team: cleanString(item.team, 120),
      due_date: cleanString(item.due_date, 40),
      priority: ["Low", "Medium", "High"].includes(item.priority) ? item.priority : "Medium",
      status: ["pending", "in_progress", "blocked", "done"].includes(item.status) ? item.status : "pending",
      evidence: cleanString(item.evidence, 360)
    })).filter((item) => item.task),
    prep_questions: prepQuestions.slice(0, 12).map((item) => ({
      question: cleanString(item.question, 260),
      intended_owner: cleanString(item.intended_owner || item.intended_team, 120),
      reason: cleanString(item.reason, 360),
      next_meeting_date: cleanString(item.next_meeting_date, 40)
    })).filter((item) => item.question)
  };
}
