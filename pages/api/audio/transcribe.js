import { requireUser } from "../../../lib/auth.js";
import { consumeQuota } from "../../../lib/supabase.js";
import { config as appConfig } from "../../../lib/config.js";
import { AppError, fetchWithTimeout, sendError } from "../../../lib/http.js";

export const config = { api: { bodyParser: { sizeLimit: "4mb" } } };
export const maxDuration = 60;
export default async function handler(req, res) {
  if (req.method !== "POST") { res.setHeader("Allow", "POST"); return res.status(405).end(); }
  res.setHeader("Cache-Control", "no-store");
  try {
    const user = await requireUser(req);
    const { base64, mimeType, duration } = req.body || {};
    if (typeof base64 !== "string" || !/^[A-Za-z0-9+/]+={0,2}$/.test(base64) || base64.length > 4000000 || !["audio/webm", "audio/ogg", "audio/mp4"].includes(mimeType) || !Number.isFinite(duration) || duration <= 0 || duration > 30) throw new AppError("Use a voice note of at most 30 seconds and 3 MB.", 400);
    if (!appConfig.sarvamApiKey) throw new AppError("Voice transcription is not configured yet. Paste your notes instead.", 503);
    await consumeQuota(user.id, "audio", 20);
    const file = new Blob([Buffer.from(base64, "base64")], { type: mimeType });
    const body = new FormData();
    body.append("file", file, "voice." + mimeType.split("/")[1]);
    body.append("model", "saaras:v3");
    body.append("mode", "transcribe");
    body.append("language_code", "unknown");
    const response = await fetchWithTimeout("https://api.sarvam.ai/speech-to-text", { method: "POST", headers: { "api-subscription-key": appConfig.sarvamApiKey }, body }, 25000);
    if (!response.ok) throw new AppError("Transcription could not finish. Please retry or paste your notes.", 502);
    const data = await response.json();
    if (!data.transcript?.trim()) throw new AppError("No speech was detected. Please try again.", 422);
    return res.status(200).json({ transcript: data.transcript, language: data.language_code });
  } catch (error) { return sendError(res, error); }
}
