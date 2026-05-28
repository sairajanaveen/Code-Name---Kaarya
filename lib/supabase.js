import { config } from "./config";
import { Buffer } from "buffer";
import { calculateMeetingScores } from "./scoring";

function enabled() {
  return Boolean(config.supabaseUrl && config.supabaseServiceKey);
}

function nullableIsoDate(value) {
  if (typeof value !== "string") return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

async function supabaseFetch(path, options = {}) {
  if (!enabled()) return { skipped: true };
  const response = await fetch(`${config.supabaseUrl}${path}`, {
    ...options,
    headers: {
      apikey: config.supabaseServiceKey,
      Authorization: `Bearer ${config.supabaseServiceKey}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(options.headers || {})
    }
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) {
    const message = data?.message || data?.error || `Supabase request failed with ${response.status}`;
    throw new Error(message);
  }
  return data;
}

function isMissingColumnError(error, columnName) {
  return String(error?.message || "").toLowerCase().includes(columnName.toLowerCase());
}

export async function createMeeting(payload, status = "intake_received") {
  if (!enabled()) {
    return {
      id: `local-${Date.now()}`,
      title: payload.meeting_name,
      meeting_date: payload.meeting_date,
      source: payload.source,
      status
    };
  }

  const [meeting] = await supabaseFetch("/rest/v1/meetings", {
    method: "POST",
    body: JSON.stringify({
      title: payload.meeting_name,
      meeting_date: payload.meeting_date,
      source: payload.source,
      transcript_url: payload.attachment_url || payload.audio_url || null,
      language: payload.language_hint || null,
      summary: null,
      readiness_score: null,
      status
    })
  });
  return meeting;
}

export async function listMeetings() {
  return supabaseFetch("/rest/v1/meetings?select=*&order=created_at.desc&limit=30");
}

export async function listTasks() {
  return supabaseFetch("/rest/v1/action_items?select=*&order=due_date.asc&limit=100");
}

export async function listPrepQuestions() {
  return supabaseFetch("/rest/v1/prep_questions?select=*&order=created_at.desc&limit=100");
}

export async function saveStructuredMeetingOutput({ meetingId, structured }) {
  if (!enabled()) {
    return { skipped: true };
  }

  const [meeting] = await supabaseFetch(`/rest/v1/meetings?id=eq.${meetingId}`, {
    method: "PATCH",
    body: JSON.stringify({
      summary: structured.summary || null,
      language: structured.language || null,
      readiness_score: structured.readiness_score ?? null,
      status: "processed"
    })
  });

  const actionItems = structured.action_items.map((item) => ({
    meeting_id: meetingId,
    task: item.task,
    owner: item.owner || null,
    team: item.team || null,
    due_date: nullableIsoDate(item.due_date),
    priority: item.priority || "Medium",
    status: item.status || "pending",
    evidence: item.evidence || null,
    follow_up_count: 0
  }));

  const prepQuestions = structured.prep_questions.map((item) => ({
    meeting_id: meetingId,
    question: item.question,
    intended_owner: item.intended_owner || null,
    intended_team: item.intended_team || null,
    reason: item.reason || null,
    next_meeting_date: nullableIsoDate(item.next_meeting_date)
  }));

  const savedActionItems = actionItems.length
    ? await supabaseFetch("/rest/v1/action_items", {
      method: "POST",
      body: JSON.stringify(actionItems)
    })
    : [];

  const savedPrepQuestions = prepQuestions.length
    ? await supabaseFetch("/rest/v1/prep_questions", {
      method: "POST",
      body: JSON.stringify(prepQuestions)
    })
    : [];

  const scores = calculateMeetingScores({
    meeting,
    tasks: savedActionItems,
    prepQuestions: savedPrepQuestions
  });

  let scoredMeeting = meeting;
  try {
    [scoredMeeting] = await supabaseFetch(`/rest/v1/meetings?id=eq.${meetingId}`, {
      method: "PATCH",
      body: JSON.stringify(scores)
    });
  } catch (error) {
    if (!isMissingColumnError(error, "efficiency_score")) throw error;
    const { efficiency_score, ...compatibleScores } = scores;
    [scoredMeeting] = await supabaseFetch(`/rest/v1/meetings?id=eq.${meetingId}`, {
      method: "PATCH",
      body: JSON.stringify(compatibleScores)
    });
  }

  return {
    meeting: scoredMeeting || meeting,
    action_items: savedActionItems,
    prep_questions: savedPrepQuestions,
    scores
  };
}

export async function saveDeliveryLogs({ meetingId, results = {}, payload = {} }) {
  if (!enabled()) return { skipped: true };

  const rows = Object.entries(results).map(([channel, result]) => ({
    meeting_id: meetingId,
    channel,
    recipient: channel === "email" ? payload.email || null : null,
    status: result?.ok ? "sent" : result?.skipped ? "skipped" : "failed",
    error: result?.ok || result?.skipped ? null : `HTTP ${result?.status || "unknown"}`
  }));

  if (!rows.length) return [];
  return supabaseFetch("/rest/v1/delivery_logs", {
    method: "POST",
    body: JSON.stringify(rows)
  });
}

export async function listDeliveryLogs() {
  return supabaseFetch("/rest/v1/delivery_logs?select=*&order=sent_at.desc&limit=50");
}

export async function getTaskByUpdateToken(token) {
  const safeToken = encodeURIComponent(token || "");
  const data = await supabaseFetch(`/rest/v1/action_items?update_token=eq.${safeToken}&select=*&limit=1`);
  return data?.[0] || null;
}

export async function updateTaskByToken(token, updates = {}) {
  const safeToken = encodeURIComponent(token || "");
  const allowedStatus = ["pending", "in_progress", "blocked", "done"];
  const status = allowedStatus.includes(updates.status) ? updates.status : "pending";
  const [task] = await supabaseFetch(`/rest/v1/action_items?update_token=eq.${safeToken}`, {
    method: "PATCH",
    body: JSON.stringify({
      status,
      evidence: updates.evidence || null,
      updated_at: new Date().toISOString()
    })
  });
  return task;
}

export async function uploadBase64Asset({ fileName, mimeType, base64 }) {
  if (!enabled()) {
    return {
      url: `local://${fileName}`,
      fileName,
      skipped: true
    };
  }

  const binary = Buffer.from(base64, "base64");
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "-");
  const path = `uploads/${Date.now()}-${safeName}`;
  const response = await fetch(`${config.supabaseUrl}/storage/v1/object/${config.supabaseStorageBucket}/${path}`, {
    method: "POST",
    headers: {
      apikey: config.supabaseServiceKey,
      Authorization: `Bearer ${config.supabaseServiceKey}`,
      "Content-Type": mimeType || "application/octet-stream",
      "x-upsert": "true"
    },
    body: binary
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || "Supabase storage upload failed");
  }

  return {
    url: `${config.supabaseUrl}/storage/v1/object/${config.supabaseStorageBucket}/${path}`,
    path,
    fileName
  };
}
