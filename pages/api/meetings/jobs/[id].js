import { requireUser } from "../../../../lib/auth.js";
import { AppError, sendError } from "../../../../lib/http.js";
import { consumeQuota } from "../../../../lib/supabase.js";
import { validUuid } from "../../../../lib/plans.js";
import { jobRpc, jobStatus, processJobStep } from "../../../../lib/transcriptJobs.js";

export const config = { api: { bodyParser: { sizeLimit: "1mb" }, responseLimit: false } };
export const maxDuration = 60;
export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  try {
    const user = await requireUser(req);
    const id = req.query.id;
    if (!validUuid(id)) throw new AppError("Upload not found.", 404);
    if (req.method === "GET") return res.json(await jobStatus(user.id, id));
    if (req.method === "DELETE") {
      await jobRpc("cancel", { p_user: user.id, p_job: id });
      return res.json({ cancelled: true });
    }
    if (req.method === "PUT") {
      const { position, content } = req.body || {};
      if (!Number.isInteger(position) || typeof content !== "string" || !content.length || content.length > 128000) throw new AppError("Invalid upload part.", 400);
      await consumeQuota(user.id, "upload_part", 180);
      await jobRpc("upload", { p_user: user.id, p_job: id, p_position: position, p_content: content });
      return res.json({ uploaded: position });
    }
    if (req.method === "POST") {
      await consumeQuota(user.id, "process_section", 720);
      return res.json(await processJobStep(user.id, id));
    }
    res.setHeader("Allow", "GET, POST, PUT, DELETE");
    return res.status(405).json({ error: "Method not allowed" });
  } catch (error) { return sendError(res, error); }
}
