import { config } from "./config";

function normalizeRecipients(to) {
  if (Array.isArray(to)) return to.map((item) => String(item || "").trim()).filter(Boolean);
  return String(to || "")
    .split(/[,\n;]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function stripSubjectFromText(text = "") {
  return String(text || "").replace(/^Subject:\s.*\n\n?/i, "").trim();
}

export async function sendDirectEmail({ to, subject, text }) {
  const recipients = normalizeRecipients(to);
  if (!recipients.length) return { ok: false, status: 400, error: "recipient required" };
  if (!config.resendApiKey) return { skipped: true, reason: "RESEND_API_KEY missing" };

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.resendApiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: config.emailFrom,
      to: recipients,
      subject,
      text: stripSubjectFromText(text)
    })
  });

  let data = {};
  try {
    data = await response.json();
  } catch {
    data = {};
  }

  return {
    ok: response.ok,
    status: response.status,
    provider: "resend",
    id: data.id || null,
    error: response.ok ? null : data.message || data.error || "Email delivery failed"
  };
}
