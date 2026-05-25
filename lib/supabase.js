import { config } from "./config";

function enabled() {
  return Boolean(config.supabaseUrl && config.supabaseServiceKey);
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
