import { config } from "./config.js";
import { sendDirectEmail } from "./email.js";
import { buildPostMeetingEmail } from "./templates.js";
import { fetchWithTimeout } from "./http.js";

export function buildPlainEmail({ meeting, structured, dashboardUrl = "" }) {
  return buildPostMeetingEmail({
    meeting,
    tasks: structured.action_items,
    prepQuestions: structured.prep_questions,
    dashboardUrl
  });
}

export async function postWebhook(url, body) {
  if (!url) return { skipped: true };
  const response = await fetchWithTimeout(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  }, 8000);
  return { ok: response.ok, status: response.status };
}

export async function publishToChannels({ meeting, structured, payload }) {
  if (payload.review_before_send) return { skipped: true };
  const emailText = buildPlainEmail({ meeting, structured });
  const compact = {
    meeting,
    summary: structured.summary,
    readiness_score: structured.readiness_score,
    action_items: structured.action_items,
    prep_questions: structured.prep_questions
  };

  const results = {};
  if (payload.destination_channels.includes("email") && !payload.review_before_send) {
    const subject = `Kaarya action items: ${meeting.title}`;
    results.email = await sendDirectEmail({
      to: payload.email,
      subject,
      text: emailText
    });

    if (!results.email.ok && config.emailWebhookUrl) {
      results.email = await postWebhook(config.emailWebhookUrl, {
        to: payload.email,
        subject,
        text: emailText
      });
    }
  }
  if (payload.destination_channels.includes("teams")) {
    results.teams = await postWebhook(config.teamsWebhookUrl, { text: emailText, ...compact });
  }
  if (payload.destination_channels.includes("slack")) {
    results.slack = await postWebhook(config.slackWebhookUrl, { text: emailText, ...compact });
  }
  return results;
}

export async function publishToNotion({ meeting, structured }) {
  if (!config.notionToken || !config.notionTasksDatabaseId) return { skipped: true };

  const created = [];
  const deadline = Date.now() + 20000;
  for (const item of structured.action_items) {
    if (Date.now() >= deadline) {
      created.push({ task: item.task, ok: false, status: 504, attempted: false });
      continue;
    }
    try {
    const response = await fetchWithTimeout("https://api.notion.com/v1/pages", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.notionToken}`,
        "Content-Type": "application/json",
        "Notion-Version": "2022-06-28"
      },
      body: JSON.stringify({
        parent: { database_id: config.notionTasksDatabaseId },
        properties: {
          Name: { title: [{ text: { content: item.task } }] },
          Owner: { rich_text: [{ text: { content: item.owner || "Unassigned" } }] },
          Team: { rich_text: [{ text: { content: item.team || "" } }] },
          Status: { select: { name: item.status } },
          Priority: { select: { name: item.priority } },
          Meeting: { rich_text: [{ text: { content: meeting.title } }] }
        },
        children: [
          {
            object: "block",
            type: "paragraph",
            paragraph: { rich_text: [{ text: { content: item.evidence || "Captured by Kaarya." } }] }
          }
        ]
      })
    }, Math.max(1, Math.min(6000, deadline - Date.now())));
    created.push({ task: item.task, ok: response.ok, status: response.status });
    } catch (error) {
      created.push({ task: item.task, ok: false, status: error.status || 502 });
    }
    if (structured.action_items.length > 1) await new Promise((resolve) => setTimeout(resolve, 350));
  }
  return { created };
}
