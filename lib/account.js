import { createHash, randomUUID } from "node:crypto";
import { AppError } from "./http.js";
import { supabaseFetch } from "./supabase.js";
import { PLANS, validUuid } from "./plans.js";

export function validateProfile(input) {
  const limits = { full_name: 100, company: 120, role: 80, language: 40, timezone: 80 };
  if (!input || typeof input !== "object" || Array.isArray(input) || Object.keys(input).some((key) => !(key in limits))) throw new AppError("Only profile details can be changed here.", 400, "INVALID_PROFILE");
  const result = {};
  for (const [key, limit] of Object.entries(limits)) {
    const value = input[key];
    if (typeof value !== "string" || value.length > limit || /[\x00-\x1f]/.test(value)) throw new AppError("Check your profile details and try again.", 400, "INVALID_PROFILE");
    result[key] = value.trim();
  }
  if (!result.full_name) throw new AppError("Enter your name.", 400, "INVALID_PROFILE");
  if (!["English", "Hindi", "Telugu", "Tamil", "Kannada", "Malayalam", "Marathi", "Bengali", "Gujarati", "Punjabi"].includes(result.language)) throw new AppError("Choose a supported language preference.", 400, "INVALID_PROFILE");
  try { new Intl.DateTimeFormat("en", { timeZone: result.timezone }); } catch { throw new AppError("Choose a valid timezone.", 400, "INVALID_PROFILE"); }
  return result;
}

export async function accountOverview(user) {
  const defaultName = String(user.user_metadata?.full_name || user.user_metadata?.name || "My account").slice(0, 100);
  const data = await supabaseFetch("/rest/v1/rpc/kaarya_account_overview", { method: "POST", body: JSON.stringify({ p_user: user.id, p_name: defaultName }) });
  return { ...data, email: user.email || "", plan: PLANS[data.plan_id] || PLANS.free, checkout_available: false };
}

export async function updateProfile(userId, input) {
  const profile = validateProfile(input);
  const rows = await supabaseFetch(`/rest/v1/user_profiles?id=eq.${encodeURIComponent(userId)}`, { method: "PATCH", body: JSON.stringify({ ...profile, updated_at: new Date().toISOString() }) });
  if (!rows?.[0]) throw new AppError("Refresh your account before saving.", 409, "PROFILE_NOT_FOUND");
  return rows[0];
}

export async function reserveGeneration({ userId, requestId, meetingId, kind = "generate", input }) {
  if (!validUuid(requestId) || (kind === "refine" && !validUuid(meetingId))) throw new AppError("Refresh the page before generating a draft.", 400, "INVALID_REQUEST_ID");
  const fingerprint = createHash("sha256").update(JSON.stringify(input)).digest("hex");
  return supabaseFetch("/rest/v1/rpc/kaarya_reserve_request", { method: "POST", body: JSON.stringify({ p_user: userId, p_request: requestId, p_meeting: kind === "generate" ? requestId : meetingId, p_kind: kind, p_hash: fingerprint, p_characters: input.payload.raw_notes.length }) });
}

export async function finishGeneration({ userId, requestId, lease, result, payload }) {
  return supabaseFetch("/rest/v1/rpc/kaarya_finish_request", { method: "POST", body: JSON.stringify({ p_user: userId, p_request: requestId, p_lease: lease, p_result: result, p_payload: payload }) });
}

export async function failGeneration(userId, requestId, lease) {
  if (!lease) return;
  return supabaseFetch("/rest/v1/rpc/kaarya_fail_request", { method: "POST", body: JSON.stringify({ p_user: userId, p_request: requestId, p_lease: lease }) });
}

export async function runMeteredGeneration({ userId, requestId = randomUUID(), meetingId, kind = "generate", input, generate }) {
  const reservation = await reserveGeneration({ userId, requestId, meetingId, kind, input });
  if (reservation.cached) return { ...reservation.result, replayed: true };
  let generated = false;
  try {
    const result = await generate();
    generated = true;
    // Completion is idempotent. Retry storage, never the model, on an ambiguous response.
    const commit = () => finishGeneration({ userId, requestId, lease: reservation.lease, result, payload: input.payload });
    try { return await commit(); } catch (error) {
      if (!["NETWORK_ERROR", "TIMEOUT", "STORAGE_ERROR"].includes(error.code)) throw error;
      return await commit();
    }
  } catch (error) {
    if (!generated) await failGeneration(userId, requestId, reservation.lease).catch(() => {});
    throw error;
  }
}
