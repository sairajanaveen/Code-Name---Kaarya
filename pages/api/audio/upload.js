import { uploadBase64Asset } from "../../../lib/supabase";

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "18mb"
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
    const asset = await uploadBase64Asset({ fileName, mimeType, base64 });
    return res.status(200).json(asset);
  } catch (error) {
    return res.status(500).json({ error: error.message || "Audio upload failed" });
  }
}
