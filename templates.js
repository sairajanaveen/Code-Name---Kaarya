function formatDate(value) {
  return value || "-";
}

function taskLine(task) {
  return `${task.task}\nOwner: ${task.owner || "Unassigned"}\nTeam: ${task.team || "-"}\nDue: ${formatDate(task.due_date)}\nStatus: ${task.status || "pending"}`;
}

export function buildPostMeetingEmail({ meeting, tasks = [], prepQuestions = [], dashboardUrl = "" }) {
  const taskRows = tasks.map((task, index) => `${index + 1}. ${taskLine(task)}`).join("\n\n");
  const questionRows = prepQuestions.map((item, index) => `${index + 1}. ${item.question}`).join("\n");

  return [
    `Subject: Action items from ${meeting.title}`,
    "",
    "Hi team,",
    "",
    `Here are the action items agreed in ${meeting.title}. Please review your ownership and update progress before the next meeting.`,
    "",
    "Action Items",
    taskRows || "No action items were captured. Please add more context before sharing this meeting.",
    "",
    "Prep Questions For The Next Meeting",
    questionRows || "No prep questions were captured yet.",
    "",
    dashboardUrl ? `Dashboard: ${dashboardUrl}` : "",
    "",
    "Regards,"
  ].filter((line) => line !== "").join("\n");
}

export function buildWhatsAppTaskNudge({ task, updateUrl = "" }) {
  return [
    `Hi ${task.owner || "there"}, quick reminder from Kaarya.`,
    "",
    `Task: ${task.task}`,
    `Due: ${formatDate(task.due_date)}`,
    `Status: ${task.status || "pending"}`,
    "",
    updateUrl ? `Please update progress here: ${updateUrl}` : "Please update once this is done."
  ].join("\n");
}

export function buildPrepReminder({ meeting, prepQuestions = [], dashboardUrl = "" }) {
  return [
    `Hi team, before the next ${meeting.title} discussion, please come prepared with:`,
    "",
    prepQuestions.map((item, index) => `${index + 1}. ${item.question}`).join("\n"),
    "",
    dashboardUrl ? `Meeting page: ${dashboardUrl}` : ""
  ].filter(Boolean).join("\n");
}

export function buildWhatsAppShareUrl(message) {
  return `https://api.whatsapp.com/send/?text=${encodeURIComponent(message)}&type=custom_url&app_absent=0`;
}
