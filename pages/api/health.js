import { integrationStatus } from "../../lib/config";

export default function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const integrations = integrationStatus();
  const required = ["supabase", "auth", "llm", "email"];
  const missing = required.filter((key) => !integrations[key]);

  return res.status(missing.length ? 207 : 200).json({
    ok: missing.length === 0,
    status: missing.length ? "configuration_missing" : "configuration_present",
    checks: "Configuration only; does not verify schema, provider quotas, OAuth or inbox delivery.",
    missing,
    integrations,
    checked_at: new Date().toISOString()
  });
}
