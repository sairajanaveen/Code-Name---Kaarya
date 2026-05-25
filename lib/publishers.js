import { config } from "./config";

export function buildPlainEmail({ meeting, structured, dashboardUrl = "" }) {
  const rows = structured.action_items.map((item, index) => (
    `${index + 1}. ${item.task}\nOwner: ${item.owner || "Unassigned"}\nTeam: ${item.team || "-"}\nDue: ${item.due_date || "-"}\nPriority: ${item.priority}\nStatus: ${item.status}\nEvidence: ${item.evidence || "-"}`
  )).join("\n\n");

  const questions = structured.prep_questions.map((item, index) => `${index + 1}. ${item.question} (${item.intended_owner || "Team"})`).join("\n");

  return [
    `Meeting: ${meeting.title}`,
    `Date: ${meeting.meeting_date || "-"}`,
    `Readiness Score: ${structured.readiness_score}/100`,
    "",
    "Action Items",
    rows || "No action items captured.",
    "",
    "Next Meeting Prep Questions",
    questions || "No prep questions captured.",
    "",
    dashboardUrl ? `Dashboard: ${dashboardUrl}` : ""
  ].filter(Boolean).join("\n");
}

export async function postWebhook(url, body) {
  if (!url) return { skipped: true };
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  return { ok: response.ok, status: response.status };
}

export async function publishToChannels({ meeting, structured, payload }) {
  const emailText = buildPlainEmail({ meeting, structured });
  const compact = {
    meeting,
    summary: structured.summary,
    readiness_score: structured.readiness_score,
    action_items: structured.action_items,
    prep_questions: structured.prep_questions
  };

  const results = {};
  if (payload.destination_channels.includes("email")) {
    results.email = await postWebhook(config.emailWebhookUrl, {
      to: payload.email,
      subject: `Kaarya action items: ${meeting.title}`,
      text: emailText
    });
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
  for (const item of structured.action_items) {
    const response = await fetch("https://api.notion.com/v1/pages", {
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
    });
    created.push({ task: item.task, ok: response.ok, status: response.status });
  }
  return { created };
}
