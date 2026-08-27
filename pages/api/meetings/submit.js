import { integrationStatus } from "../../../lib/config";
import { createMeeting, saveDeliveryLogs, saveStructuredMeetingOutput } from "../../../lib/supabase";
import { normalizeIntakePayload } from "../../../lib/intake";
import { validateMeetingPayload } from "../../../lib/validate";
import { config as appConfig } from "../../../lib/config";
import { extractAccountability } from "../../../lib/aiPipeline";
import { publishToChannels, publishToNotion } from "../../../lib/publishers";

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "4mb"
    }
  }
};

async function safeStep(label, action, fallback = { skipped: true }) {
  try {
    return await action();
  } catch (error) {
    return {
      ...fallback,
      ok: false,
      warning: `${label} failed`,
      error: error.message || String(error)
    };
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { ok, payload, errors } = validateMeetingPayload(normalizeIntakePayload(req.body));
  if (!ok) return res.status(400).json({ errors });

  try {
    const meeting = await createMeeting(payload, "intake_received");

    const makeResult = await safeStep("Make intake", async () => {
      if (!appConfig.makeWebhookUrl) return { skipped: true };
      const makeResponse = await fetch(appConfig.makeWebhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...payload,
          meeting_id: meeting.id,
          platform_source: "kaarya_v1",
          execution_type: "meeting_intake"
        })
      });
      return { ok: makeResponse.ok, status: makeResponse.status };
    });

    const structured = await extractAccountability({ meeting, payload });
    const saved = await saveStructuredMeetingOutput({ meetingId: meeting.id, structured });
    const notion = await safeStep("Notion sync", async () => (
      payload.destination_channels.includes("notion")
        ? publishToNotion({ meeting, structured })
        : { skipped: true }
    ));
    const delivery = await safeStep("Delivery", async () => publishToChannels({ meeting, structured, payload }), {});
    const deliveryLogs = await safeStep("Delivery logs", async () => saveDeliveryLogs({ meetingId: meeting.id, results: delivery, payload }));

    return res.status(200).json({
      meeting,
      structured,
      integrations: integrationStatus(),
      saved,
      make: makeResult,
      notion,
      delivery,
      deliveryLogs
    });
  } catch (error) {
    return res.status(500).json({ error: error.message || "Submission failed" });
  }
}
