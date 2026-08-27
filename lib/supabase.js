import { config } from "./config.js";
import { Buffer } from "buffer";
import { calculateMeetingScores } from "./scoring.js";
import { AppError, fetchWithTimeout } from "./http.js";

function enabled() {
  return Boolean(config.supabaseUrl && config.supabaseServiceKey);
}

function nullableIsoDate(value) {
  if (typeof value !== "string") return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

async function supabaseFetch(path, options = {}) {
  if (!enabled()) return { skipped: true };
  const response = await fetchWithTimeout(`${config.supabaseUrl}${path}`, {
    ...options,
    headers: {
      apikey: config.supabaseServiceKey,
      Authorization: `Bearer ${config.supabaseServiceKey}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(options.headers || {})
    }
  }, 8000);

  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text ? { message: text } : null;
  }
  if (!response.ok) {
    const message = data?.message || data?.error || `Supabase request failed with ${response.status}`;
    if (data?.code === "PGRST202" || data?.code === "42703") throw new AppError("The workspace needs the latest database update. Your draft is still available to copy.", 503, "SCHEMA_UPDATE_REQUIRED");
    if (message.includes("STALE_DRAFT")) throw new AppError("This meeting was changed in another tab. Reopen it from History before saving.", 409, "STALE_DRAFT");
    throw new AppError("The workspace could not save or load this request. Please retry.", 502, "STORAGE_ERROR");
  }
  return data;
}

function isMissingColumnError(error, columnName) {
  return String(error?.message || "").toLowerCase().includes(columnName.toLowerCase());
}

async function patchMeetingScores(meetingId, scores) {
  const remaining = { ...scores };
  const scoreColumns = Object.keys(scores);

  for (let attempts = 0; attempts <= scoreColumns.length; attempts += 1) {
    try {
      const [meeting] = await supabaseFetch(`/rest/v1/meetings?id=eq.${meetingId}`, {
        method: "PATCH",
        body: JSON.stringify(remaining)
      });
      return meeting;
    } catch (error) {
      const missingColumn = scoreColumns.find((column) => remaining[column] !== undefined && isMissingColumnError(error, column));
      if (!missingColumn) throw error;
      delete remaining[missingColumn];
      if (!Object.keys(remaining).length) return null;
    }
  }

  return null;
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

export async function listMeetings(userId) {
  if (!userId) throw new AppError("Sign in to view meetings.", 401);
  return supabaseFetch(`/rest/v1/meetings?created_by=eq.${encodeURIComponent(userId)}&select=*&order=created_at.desc&limit=30`);
}

export async function listTasks(userId, meetingId) {
  if (!userId) throw new AppError("Sign in to view tasks.", 401);
  if (meetingId && !/^[0-9a-f-]{36}$/i.test(meetingId)) throw new AppError("Meeting not found.", 404);
  const filter = meetingId ? `&meeting_id=eq.${encodeURIComponent(meetingId)}` : "";
  return supabaseFetch(`/rest/v1/action_items?select=*,meetings!inner(created_by)&meetings.created_by=eq.${encodeURIComponent(userId)}${filter}&order=due_date.asc&limit=200`);
}

export async function listPrepQuestions(userId) {
  if (!userId) throw new AppError("Sign in to view preparation questions.", 401);
  return supabaseFetch(`/rest/v1/prep_questions?select=*,meetings!inner(created_by)&meetings.created_by=eq.${encodeURIComponent(userId)}&order=created_at.desc&limit=150`);
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

  const scoredMeeting = await patchMeetingScores(meetingId, scores);

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
    status: result?.ok ? (result?.scheduled ? "scheduled" : "accepted") : result?.skipped ? "skipped" : "failed",
    error: result?.ok || result?.skipped ? null : `HTTP ${result?.status || "unknown"}`
  }));

  if (!rows.length) return [];
  return supabaseFetch("/rest/v1/delivery_logs", {
    method: "POST",
    body: JSON.stringify(rows)
  });
}

export async function listDeliveryLogs(userId) {
  if (!userId) throw new AppError("Sign in to view deliveries.", 401);
  return supabaseFetch(`/rest/v1/delivery_logs?select=*,meetings!inner(created_by)&meetings.created_by=eq.${encodeURIComponent(userId)}&order=sent_at.desc&limit=50`);
}

export async function consumeQuota(userId, operation, limit) {
  if (!enabled()) throw new AppError("Workspace storage is not configured yet.", 503, "STORAGE_NOT_CONFIGURED");
  const allowed = await supabaseFetch("/rest/v1/rpc/consume_kaarya_quota", {
    method: "POST", body: JSON.stringify({ p_key: `${userId}:${operation}`, p_limit: limit })
  });
  if (!allowed) throw new AppError("You have reached the hourly limit. Please try again later.", 429, "RATE_LIMITED");
}

export async function getOwnedMeeting(meetingId, userId) {
  if (!/^[0-9a-f-]{36}$/i.test(meetingId || "")) throw new AppError("Save the meeting before sending.", 400);
  const data = await supabaseFetch(`/rest/v1/meetings?id=eq.${meetingId}&created_by=eq.${encodeURIComponent(userId)}&select=*&limit=1`);
  if (!data?.[0]) throw new AppError("Meeting not found in your workspace.", 404);
  return data[0];
}

export async function saveReviewedDraft({ userId, meeting, structured, actionIds, revision, saveId, notes }) {
  if (!enabled()) throw new AppError("Workspace storage is not configured yet.", 503);
  return supabaseFetch("/rest/v1/rpc/save_kaarya_draft", {
    method: "POST", body: JSON.stringify({
      p_user: userId, p_meeting: meeting.id, p_title: meeting.title, p_date: meeting.meeting_date,
      p_output: structured, p_action_ids: actionIds, p_revision: revision, p_save_id: saveId, p_notes: notes
    })
  });
}

export async function getTaskByUpdateToken(token) {
  if (typeof token !== "string" || !/^[a-f0-9]{36}$/.test(token)) return null;
  const safeToken = encodeURIComponent(token || "");
  const data = await supabaseFetch(`/rest/v1/action_items?update_token=eq.${safeToken}&select=*&limit=1`);
  return data?.[0] || null;
}

export async function markTaskNudged(token, channel = "whatsapp") {
  if (!enabled()) return { skipped: true };
  const safeToken = encodeURIComponent(token || "");
  const now = new Date().toISOString();
  try {
    const [task] = await supabaseFetch(`/rest/v1/action_items?update_token=eq.${safeToken}`, {
      method: "PATCH",
      body: JSON.stringify({
        last_nudged_at: now,
        last_nudge_channel: channel,
        updated_at: now
      })
    });
    return task;
  } catch (error) {
    if (!isMissingColumnError(error, "last_nudged_at") && !isMissingColumnError(error, "last_nudge_channel")) {
      throw error;
    }
    return { skipped: true, reason: "nudge columns missing" };
  }
}

export async function updateTaskByToken(token, updates = {}) {
  if (typeof token !== "string" || !/^[a-f0-9]{36}$/.test(token)) throw new AppError("Task not found.", 404);
  const allowedStatus = ["pending", "in_progress", "blocked", "done"];
  if (!allowedStatus.includes(updates.status) || typeof updates.update_note !== "string" || updates.update_note.length > 2000) throw new AppError("Choose a valid status and keep the note under 2,000 characters.", 400);
  return supabaseFetch("/rest/v1/rpc/update_kaarya_task", {
    method: "POST", body: JSON.stringify({ p_token: token, p_status: updates.status, p_note: updates.update_note })
  });
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
