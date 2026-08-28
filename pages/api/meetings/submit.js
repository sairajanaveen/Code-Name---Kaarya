import { randomUUID, timingSafeEqual } from "node:crypto";
import { requireUser } from "../../../lib/auth.js";
import { config as appConfig } from "../../../lib/config.js";
import { normalizeIntakePayload } from "../../../lib/intake.js";
import { validateMeetingPayload } from "../../../lib/validate.js";
import { extractAccountability } from "../../../lib/aiPipeline.js";
import { AppError, sendError } from "../../../lib/http.js";
import { consumeQuota } from "../../../lib/supabase.js";
import { runMeteredGeneration } from "../../../lib/account.js";
import { validUuid } from "../../../lib/plans.js";

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
    const user = trustedIntake(req) ? { id: process.env.INTAKE_OWNER_USER_ID } : await requireUser(req);
    if (!validUuid(user.id)) throw new AppError("This intake connection needs a verified workspace owner before it can process meetings.", 503, "INTAKE_OWNER_REQUIRED");
    await consumeQuota(user.id, "extract", 12);
    streaming = String(req.headers.accept || "").includes("application/x-ndjson");
    if (streaming) {
      res.setHeader("Content-Type", "application/x-ndjson; charset=utf-8");
      res.setHeader("X-Accel-Buffering", "no");
      res.flushHeaders();
    }
    const emit = (event) => { if (streaming && !res.destroyed) res.write(JSON.stringify(event) + "\n"); };
    emit({ type: "stage", stage: "reading" });
    const data = await runMeteredGeneration({
      userId: user.id, requestId: req.body?.request_id || randomUUID(), input: { payload: validation.payload },
      generate: () => extractAccountability({ payload: validation.payload, signal: controller.signal, onStage: (stage) => emit({ type: "stage", stage }) })
    });
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
