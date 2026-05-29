import { buildPostMeetingEmail, buildPrepReminder, buildWhatsAppShareUrl, buildWhatsAppTaskNudge } from "../../../lib/templates";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { meeting = {}, tasks = [], prep_questions = [], type = "email" } = req.body || {};

  if (type === "email") {
    const text = buildPostMeetingEmail({ meeting, tasks, prepQuestions: prep_questions });
    return res.status(200).json({ text });
  }

  if (type === "prep") {
    const text = buildPrepReminder({ meeting, prepQuestions: prep_questions });
    return res.status(200).json({ text, whatsapp_url: buildWhatsAppShareUrl(text) });
  }

  if (type === "whatsapp_task") {
    const task = tasks[0];
    if (!task) return res.status(400).json({ error: "Task is required" });
    const text = buildWhatsAppTaskNudge({ task, updateUrl: task.update_url || "" });
    return res.status(200).json({ text, whatsapp_url: buildWhatsAppShareUrl(text) });
  }

  return res.status(400).json({ error: "Unsupported draft type" });
}
