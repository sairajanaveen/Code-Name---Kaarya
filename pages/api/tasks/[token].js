import { getTaskByUpdateToken, updateTaskByToken } from "../../../lib/supabase.js";
import { consumeQuota } from "../../../lib/supabase.js";
import { sendError } from "../../../lib/http.js";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  const { token } = req.query;

  if (!token) return res.status(400).json({ error: "Task token is required" });

  try {
    if (req.method === "GET") {
      const task = await getTaskByUpdateToken(token);
      if (!task) return res.status(404).json({ error: "Task not found" });
      return res.status(200).json({ task });
    }

    if (req.method === "PATCH") {
      if (typeof token !== "string" || !/^[a-f0-9]{36}$/.test(token)) return res.status(404).json({ error: "Task not found" });
      await consumeQuota(token, "task-update", 30);
      const task = await updateTaskByToken(token, req.body || {});
      if (!task) return res.status(404).json({ error: "Task not found" });
      return res.status(200).json({ task });
    }
  } catch (error) {
    return sendError(res, error);
  }

  res.setHeader("Allow", "GET, PATCH");
  return res.status(405).json({ error: "Method not allowed" });
}
