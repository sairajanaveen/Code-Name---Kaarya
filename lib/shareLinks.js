import { validEmail } from "./meetingInput.js";
import { buildWhatsAppShareUrl } from "./templates.js";

export function composeLink(channel, { to = "", subject = "", text = "" }) {
  const recipients = to.split(/[,;]/).map((value) => value.trim()).filter(Boolean);
  if (recipients.some((value) => !validEmail(value))) return { error: "Enter valid recipient email addresses, separated by commas." };
  const safeSubject = subject.replace(/[\r\n]/g, " ");
  const urlFor = (body) => {
    if (channel === "whatsapp") return buildWhatsAppShareUrl(body);
    if (channel === "gmail") return "https://mail.google.com/mail/?" + new URLSearchParams({ view: "cm", fs: "1", to: recipients.join(","), su: safeSubject, body });
    if (channel === "outlook") return "https://outlook.office.com/mail/deeplink/compose?" + new URLSearchParams({ to: recipients.join(";"), subject: safeSubject, body });
    return "mailto:" + recipients.map(encodeURIComponent).join(",") + "?subject=" + encodeURIComponent(safeSubject) + "&body=" + encodeURIComponent(body.replace(/\r?\n/g, "\r\n"));
  };
  const url = urlFor(text);
  // Native handlers have different URL limits. Never silently send a clipped report.
  const needsPaste = url.length > (channel === "mailto" ? 1800 : 7500);
  return { href: needsPaste ? urlFor("") : url, needsPaste };
}
