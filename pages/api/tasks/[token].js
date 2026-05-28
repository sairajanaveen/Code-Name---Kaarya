import { getTaskByUpdateToken, updateTaskByToken } from "../../../lib/supabase";

export default async function handler(req, res) {
  const { token } = req.query;

  if (!token) return res.status(400).json({ error: "Task token is required" });

  if (req.method === "GET") {
    const task = await getTaskByUpdateToken(token);
    if (!task) return res.status(404).json({ error: "Task not found" });
    return res.status(200).json({ task });
  }

  if (req.method === "PATCH") {
    const task = await updateTaskByToken(token, req.body || {});
    if (!task) return res.status(404).json({ error: "Task not found" });
    return res.status(200).json({ task });
  }

  res.setHeader("Allow", "GET, PATCH");
  return res.status(405).json({ error: "Method not allowed" });
}
