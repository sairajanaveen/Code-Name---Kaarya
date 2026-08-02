import { sendDirectEmail } from "../../../lib/email";
import { saveDeliveryLogs } from "../../../lib/supabase";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { to = "", subject = "Kaarya meeting action items", text = "", meeting_id = "" } = req.body || {};
  if (!to || !String(to).includes("@")) return res.status(400).json({ error: "Valid recipient email is required" });
  if (!String(text).trim()) return res.status(400).json({ error: "Email body is required" });

  const result = await sendDirectEmail({ to, subject, text });
  if (meeting_id) {
    await saveDeliveryLogs({
      meetingId: meeting_id,
      results: { email: result },
      payload: { email: to }
    });
  }

  if (!result.ok) {
    return res.status(result.status || 500).json({ error: result.error || "Email delivery failed", result });
  }

  return res.status(200).json({ result });
}
