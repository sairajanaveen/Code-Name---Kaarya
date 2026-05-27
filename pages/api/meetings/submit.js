import { integrationStatus } from "../../../lib/config";
import { createMeeting, saveStructuredMeetingOutput } from "../../../lib/supabase";
import { validateMeetingPayload } from "../../../lib/validate";
import { config } from "../../../lib/config";
import { extractAccountability } from "../../../lib/aiPipeline";
import { publishToChannels, publishToNotion } from "../../../lib/publishers";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { ok, payload, errors } = validateMeetingPayload(req.body);
  if (!ok) return res.status(400).json({ errors });

  try {
    const meeting = await createMeeting(payload, "intake_received");

    let makeResult = { skipped: true };
    if (config.makeWebhookUrl) {
      const makeResponse = await fetch(config.makeWebhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...payload,
          meeting_id: meeting.id,
          platform_source: "kaarya_v1",
          execution_type: "meeting_intake"
        })
      });
      makeResult = { ok: makeResponse.ok, status: makeResponse.status };
    }

    const structured = await extractAccountability({ meeting, payload });
    const saved = await saveStructuredMeetingOutput({ meetingId: meeting.id, structured });
    const notion = payload.destination_channels.includes("notion")
      ? await publishToNotion({ meeting, structured })
      : { skipped: true };
    const delivery = await publishToChannels({ meeting, structured, payload });

    return res.status(200).json({
      meeting,
      structured,
      integrations: integrationStatus(),
      saved,
      make: makeResult,
      notion,
      delivery
    });
  } catch (error) {
    return res.status(500).json({ error: error.message || "Submission failed" });
  }
}
