import { config } from "./config.js";
import { fetchWithTimeout } from "./http.js";
import { plainTextToHtml } from "./templates.js";
import { validEmail } from "./validate.js";

export async function sendDirectEmail({ to, subject, text, scheduledAt, idempotencyKey }) {
  const recipients = (Array.isArray(to) ? to : String(to || "").split(/[,;\n]/)).map((item) => String(item).trim()).filter(Boolean);
  if (!recipients.length || recipients.length > 10 || !recipients.every(validEmail)) return { ok: false, status: 400, error: "Enter up to ten valid recipient email addresses." };
  if (!config.resendApiKey) return { ok: false, status: 503, error: "Email is not configured yet. You can copy the draft." };
  const body = String(text || "").replace(/^Subject:\s.*\r?\n\r?\n?/i, "").trim();
  const response = await fetchWithTimeout("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: "Bearer " + config.resendApiKey, "Content-Type": "application/json", ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}) },
    body: JSON.stringify({ from: config.emailFrom, to: recipients, subject, text: body, html: plainTextToHtml(body), ...(scheduledAt ? { scheduled_at: scheduledAt } : {}) })
  }, 15000);
  const data = await response.json().catch(() => ({}));
  return { ok: response.ok, status: response.status, provider: "resend", id: data.id || null, scheduled: Boolean(scheduledAt), error: response.ok ? null : "Email was not accepted by the provider. Check the sender domain and recipient, or copy the draft." };
}
