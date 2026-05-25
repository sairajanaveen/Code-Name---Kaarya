import { integrationStatus } from "../../../lib/config";
import { sampleMeetings } from "../../../lib/mockData";
import { listMeetings } from "../../../lib/supabase";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const data = await listMeetings();
    return res.status(200).json({
      meetings: data?.skipped ? sampleMeetings : data,
      integrations: integrationStatus(),
      demo: Boolean(data?.skipped)
    });
  } catch (error) {
    return res.status(200).json({
      meetings: sampleMeetings,
      integrations: integrationStatus(),
      demo: true,
      warning: error.message
    });
  }
}
