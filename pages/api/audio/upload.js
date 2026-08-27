import { uploadBase64Asset } from "../../../lib/supabase";
import { requireUser } from "../../../lib/auth.js";
import { AppError, sendError } from "../../../lib/http.js";

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "4mb"
    }
  }
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { fileName = "meeting-audio.webm", mimeType = "audio/webm", base64 } = req.body || {};
  if (!base64) return res.status(400).json({ error: "base64 audio payload is required" });

  try {
    await requireUser(req);
    if (typeof base64 !== "string" || base64.length > 4000000 || !["audio/webm", "audio/mp4", "audio/ogg"].includes(mimeType)) throw new AppError("Use an audio file smaller than 3 MB.", 400);
    const asset = await uploadBase64Asset({ fileName, mimeType, base64 });
    return res.status(200).json(asset);
  } catch (error) {
    return sendError(res, error);
  }
}
