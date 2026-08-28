import { useEffect, useState } from "react";
import { Copy, Download, ExternalLink, Mail, MessageCircle, X } from "lucide-react";
import { composeLink } from "../lib/shareLinks";
import { plainTextToHtml } from "../lib/templates";

export default function ShareDraft({ channel, report, whatsapp, title, onClose }) {
  const [to, setTo] = useState("");
  const [provider, setProvider] = useState("gmail");
  const [message, setMessage] = useState(channel === "whatsapp" ? whatsapp : report.replace(/^Subject:.*\n\n/, ""));
  const [feedback, setFeedback] = useState("");
  const [copied, setCopied] = useState(false);
  useEffect(() => { setCopied(false); setFeedback(""); }, [message, provider, to]);
  const link = composeLink(channel === "whatsapp" ? "whatsapp" : provider, { to: channel === "whatsapp" ? "" : to, subject: "Meeting minutes - " + title, text: message });
  async function copy() {
    try {
      if (channel === "email" && window.ClipboardItem && navigator.clipboard?.write) {
        try { await navigator.clipboard.write([new ClipboardItem({ "text/plain": new Blob([message], { type: "text/plain" }), "text/html": new Blob([plainTextToHtml(message)], { type: "text/html" }) })]); }
        catch { await navigator.clipboard.writeText(message); }
      } else await navigator.clipboard.writeText(message);
      setCopied(true); setFeedback("Copied. Your full message is ready to paste.");
    } catch { setFeedback("Clipboard permission was denied. Select the message below and copy it, or download the minutes."); }
  }
  function download() {
    const href = URL.createObjectURL(new Blob([plainTextToHtml(message)], { type: "text/html;charset=utf-8" }));
    const anchor = document.createElement("a"); anchor.href = href; anchor.download = "kaarya-meeting-minutes.html"; anchor.click(); URL.revokeObjectURL(href);
  }
  return <section className="share-draft" aria-label={channel === "whatsapp" ? "WhatsApp draft" : "Email compose draft"}>
    <div className="section-heading"><h2>{channel === "whatsapp" ? <MessageCircle size={20} /> : <Mail size={20} />}{channel === "whatsapp" ? "WhatsApp message" : "Email from your account"}</h2><button className="icon-button" onClick={onClose} aria-label="Close sharing draft" title="Close sharing draft"><X size={18} /></button></div>
    {channel === "email" && <div className="field-grid"><label className="field"><span>To (optional)</span><input type="email" multiple value={to} onChange={(event) => setTo(event.target.value)} placeholder="colleague@company.com" /></label><label className="field"><span>Open with</span><select value={provider} onChange={(event) => setProvider(event.target.value)}><option value="gmail">Gmail</option><option value="outlook">Outlook on the web</option><option value="mailto">Default mail app</option></select></label></div>}
    <label className="field"><span>Message</span><textarea rows={12} value={message} onChange={(event) => setMessage(event.target.value)} /></label>
    {link.error && <p role="alert" className="field-error">{link.error}</p>}
    {link.needsPaste && <p className="share-note">This report is longer than a compose link can reliably carry. Copy the full message, then paste it in {channel === "whatsapp" ? "WhatsApp" : "your email draft"}. No content is shortened.</p>}
    {feedback && <p role="status" className="share-note">{feedback}</p>}
    <div className="button-row"><button className="button" onClick={copy}><Copy size={16} />{copied ? "Copied" : "Copy message"}</button><button className="icon-button" title="Download formatted minutes" aria-label="Download formatted minutes" onClick={download}><Download size={18} /></button>{!link.error && <a className="button primary" href={link.href} target={provider === "mailto" && channel === "email" ? undefined : "_blank"} rel="noopener noreferrer" referrerPolicy="no-referrer"><ExternalLink size={16} />Open {channel === "whatsapp" ? "WhatsApp" : provider === "gmail" ? "Gmail" : provider === "outlook" ? "Outlook" : "mail app"}</a>}</div>
    <p className="share-note">{channel === "whatsapp" ? "Choose the chat and review the message in WhatsApp before sending." : "Choose your signed-in account in the mail app. Kaarya does not read your inbox or send this draft automatically."}</p>
  </section>;
}
