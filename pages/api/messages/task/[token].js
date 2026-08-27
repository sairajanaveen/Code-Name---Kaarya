import { getTaskByUpdateToken, markTaskNudged } from "../../../../lib/supabase";
import { buildWhatsAppShareUrl, buildWhatsAppTaskNudge } from "../../../../lib/templates";

export default async function handler(req, res) {
  const { token } = req.query;

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  let task;
  try {
    task = await getTaskByUpdateToken(token);
  } catch (error) {
    return res.status(500).json({ error: error.message || "Could not load task" });
  }
  if (!task) return res.status(404).json({ error: "Task not found" });

  const host = req.headers.host ? `https://${req.headers.host}` : "";
  const updateUrl = `${host}/task/${token}`;
  const whatsappText = buildWhatsAppTaskNudge({ task, updateUrl });
  try {
    await markTaskNudged(token, "whatsapp");
  } catch {
    // The share link is still useful even if nudge telemetry cannot be saved.
  }

  return res.status(200).json({
    task,
    update_url: updateUrl,
    whatsapp_text: whatsappText,
    whatsapp_url: buildWhatsAppShareUrl(whatsappText)
  });
}
