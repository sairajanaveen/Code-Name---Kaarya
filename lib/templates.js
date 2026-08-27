export function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
}
const cell = (value) => String(value || "").replace(/[\t\r\n]+/g, " ").trim();
export function buildPostMeetingEmail({ meeting, tasks = [], prepQuestions = [], dashboardUrl = "" }) {
  const rows = tasks.map((task) => [task.task, task.owner || "Unassigned", task.due_date || "Not set", (task.status || "pending").replace("_", " ")].map(cell).join("\t"));
  return [
    "Subject: Actions from " + meeting.title, "", "Hi team,", "",
    meeting.summary || "Here are the actions and open questions from " + meeting.title + ".", "",
    "Action items", tasks.length ? "Action\tOwner\tDue\tStatus" : "No agreed action items were found.",
    ...rows, "", ...(prepQuestions.length ? ["For the next meeting", ...prepQuestions.map((item, i) => (i + 1) + ". " + (item.intended_owner ? item.intended_owner + ": " : "") + item.question), ""] : []),
    ...(dashboardUrl ? ["Meeting workspace: " + dashboardUrl, ""] : []), "Thank you."
  ].join("\n");
}
export function plainTextToHtml(text) {
  const lines = String(text).replace(/^Subject:.*\r?\n/i, "").split(/\r?\n/);
  let inTable = false;
  const parts = [];
  for (const line of lines) {
    if (line.includes("\t")) {
      if (!inTable) { parts.push('<table style="border-collapse:collapse;width:100%;font-family:Arial,sans-serif;font-size:14px">'); inTable = true; }
      parts.push("<tr>" + line.split("\t").map((value) => '<td style="border:1px solid #d4d4d4;padding:8px;vertical-align:top">' + escapeHtml(value) + "</td>").join("") + "</tr>");
    } else {
      if (inTable) { parts.push("</table>"); inTable = false; }
      parts.push(line ? '<p style="margin:10px 0">' + escapeHtml(line) + "</p>" : "<br>");
    }
  }
  if (inTable) parts.push("</table>");
  return '<div style="font-family:Arial,sans-serif;color:#171717;line-height:1.5">' + parts.join("") + "</div>";
}
export function buildMeetingWhatsApp({ meeting, tasks = [] }) {
  return [meeting.title, "", ...tasks.map((task, i) => (i + 1) + ". " + task.task + "\n" + (task.owner || "Unassigned") + " | Due: " + (task.due_date || "Not set") + " | " + (task.status || "pending").replace("_", " "))].join("\n");
}
export function buildWhatsAppTaskNudge({ task, updateUrl = "" }) {
  return ["Hi " + (task.owner || "there") + ",", "Could you share an update on " + task.task + "?", "Due: " + (task.due_date || "Not set"), ...(updateUrl ? ["Update: " + updateUrl] : [])].join("\n");
}
export function buildPrepReminder({ meeting, prepQuestions = [], dashboardUrl = "" }) {
  return ["For the next " + meeting.title + ":", ...prepQuestions.map((item, i) => (i + 1) + ". " + item.question), dashboardUrl].filter(Boolean).join("\n");
}
export const buildWhatsAppShareUrl = (message) => "https://api.whatsapp.com/send/?text=" + encodeURIComponent(message);
