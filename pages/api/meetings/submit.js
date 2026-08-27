import { randomUUID, timingSafeEqual } from "node:crypto";
import { requireUser } from "../../../lib/auth.js";
import { config as appConfig } from "../../../lib/config.js";
import { normalizeIntakePayload } from "../../../lib/intake.js";
import { validateMeetingPayload } from "../../../lib/validate.js";
import { extractAccountability } from "../../../lib/aiPipeline.js";
import { AppError, sendError } from "../../../lib/http.js";
import { consumeQuota } from "../../../lib/supabase.js";

export const config = { api: { bodyParser: { sizeLimit: "512kb" }, responseLimit: false } };
export const maxDuration = 60;

function trustedIntake(req) {
  const secret = appConfig.intakeWebhookSecret;
  const incoming = req.headers["x-kaarya-intake-key"];
  return secret && typeof incoming === "string" && Buffer.byteLength(secret) === Buffer.byteLength(incoming)
    && timingSafeEqual(Buffer.from(secret), Buffer.from(incoming));
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }
  res.setHeader("Cache-Control", "no-store");
  let streaming = false;
  const controller = new AbortController();
  const disconnected = () => { if (!res.writableEnded) controller.abort(); };
  res.on("close", disconnected);
  try {
    const validation = validateMeetingPayload(normalizeIntakePayload(req.body || {}));
    if (!validation.ok) return res.status(400).json({ error: validation.errors.join(" "), errors: validation.errors });
    const user = trustedIntake(req) ? { id: "integration" } : await requireUser(req);
    await consumeQuota(user.id, "extract", 12);
    streaming = String(req.headers.accept || "").includes("application/x-ndjson");
    if (streaming) {
      res.setHeader("Content-Type", "application/x-ndjson; charset=utf-8");
      res.setHeader("X-Accel-Buffering", "no");
      res.flushHeaders();
    }
    const emit = (event) => { if (streaming && !res.destroyed) res.write(JSON.stringify(event) + "\n"); };
    emit({ type: "stage", stage: "reading" });
    const result = await extractAccountability({
      payload: validation.payload, signal: controller.signal,
      onStage: (stage) => emit({ type: "stage", stage })
    });
    const data = {
      ...result,
      meeting: { id: randomUUID(), title: validation.payload.meeting_name, meeting_date: validation.payload.meeting_date, status: "draft" },
      saved: false,
      delivery: { status: "not_sent" }
    };
    if (streaming) { emit({ type: "result", data }); return res.end(); }
    return res.status(200).json(data);
  } catch (error) {
    if (res.destroyed) return;
    if (streaming) {
      res.write(JSON.stringify({ type: "error", error: error instanceof AppError ? error.message : "The draft could not be completed. Your notes have not been sent.", code: error.code || "REQUEST_FAILED" }) + "\n");
      return res.end();
    }
    return sendError(res, error);
  } finally { res.off("close", disconnected); }
}
