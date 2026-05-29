import { getTaskByUpdateToken, markTaskNudged } from "../../../../lib/supabase";
import { buildWhatsAppShareUrl, buildWhatsAppTaskNudge } from "../../../../lib/templates";

export default async function handler(req, res) {
  const { token } = req.query;

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const task = await getTaskByUpdateToken(token);
  if (!task) return res.status(404).json({ error: "Task not found" });

  const host = req.headers.host ? `https://${req.headers.host}` : "";
  const updateUrl = `${host}/task/${token}`;
  const whatsappText = buildWhatsAppTaskNudge({ task, updateUrl });
  await markTaskNudged(token, "whatsapp");

  return res.status(200).json({
    task,
    update_url: updateUrl,
    whatsapp_text: whatsappText,
    whatsapp_url: buildWhatsAppShareUrl(whatsappText)
  });
}
