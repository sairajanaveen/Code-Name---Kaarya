import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, Save, ShieldCheck, UserRound, ArrowRight } from "lucide-react";
import { formatINR } from "../lib/plans";

export default function AccountPanel({ account, onSave, onPricing, busy }) {
  const [fields, setFields] = useState(null);
  useEffect(() => {
    if (account?.profile) setFields(Object.fromEntries(["full_name", "company", "role", "language", "timezone"].map((key) => [key, account.profile[key] || ""])));
  }, [account?.profile]);
  if (!account || !fields) return <section className="empty-state"><UserRound size={28} /><h1>Your account</h1><p role="status">Loading account details...</p></section>;
  const { plan, usage } = account;
  const change = (key, value) => setFields((old) => ({ ...old, [key]: value }));
  return <section>
    <div className="section-heading"><div><p className="eyebrow">Your workspace</p><h1>Profile & usage</h1></div><span className="badge">{plan.name}</span></div>
    <div className="account-layout">
      <form onSubmit={(event) => { event.preventDefault(); onSave(fields); }}>
        <div className="identity-line"><span className="profile-avatar" aria-hidden="true">{fields.full_name.trim().slice(0, 1).toUpperCase() || "K"}</span><div><strong>{fields.full_name}</strong><span><CheckCircle2 size={14} />{account.email}</span></div></div>
        <div className="field-grid">
          <label className="field"><span>Name</span><input required maxLength={100} value={fields.full_name} onChange={(e) => change("full_name", e.target.value)} /></label>
          <label className="field"><span>Company (optional)</span><input maxLength={120} value={fields.company} onChange={(e) => change("company", e.target.value)} /></label>
          <label className="field"><span>Role (optional)</span><input maxLength={80} value={fields.role} onChange={(e) => change("role", e.target.value)} /></label>
          <label className="field"><span>Meeting language</span><select value={fields.language} onChange={(e) => change("language", e.target.value)}>{["English", "Hindi", "Telugu", "Tamil", "Kannada", "Malayalam", "Marathi", "Bengali", "Gujarati", "Punjabi"].map((language) => <option key={language}>{language}</option>)}</select></label>
          <label className="field"><span>Timezone</span><input required maxLength={80} value={fields.timezone} onChange={(e) => change("timezone", e.target.value)} list="account-timezones" /><datalist id="account-timezones">{["Asia/Kolkata", "Asia/Dubai", "Europe/London", "America/New_York", "Asia/Singapore", "UTC"].map((zone) => <option key={zone} value={zone} />)}</datalist></label>
        </div>
        <button className="button primary" disabled={busy} type="submit">{busy ? <Loader2 size={16} className="spin" /> : <Save size={16} />}Save profile</button>
      </form>
      <aside className="usage-panel">
        <p className="eyebrow">Current plan</p><h2>{plan.name} <span>{formatINR(plan.price)} / month</span></h2>
        <div className="usage-line"><label htmlFor="generation-usage">{plan.period === "day" ? "Meetings today" : "Meetings this month"}</label><strong>{usage.generated} / {plan.meetings}</strong></div>
        <progress id="generation-usage" aria-label="Meeting allowance used" max={plan.meetings} value={Math.min(usage.generated, plan.meetings)} />
        <div className="usage-line"><label htmlFor="storage-usage">Retained meetings</label><strong>{usage.retained} / {plan.retained}</strong></div>
        <progress id="storage-usage" aria-label="Retained meeting capacity used" max={plan.retained} value={Math.min(usage.retained, plan.retained)} />
        <p className="usage-detail">Allowance resets {new Date(usage.reset_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" })} IST.</p>
        <p className="usage-detail">{plan.inputCharacters.toLocaleString("en-IN")} characters per meeting. {plan.refinements} AI refinement{plan.refinements > 1 ? "s" : ""} per meeting{plan.id === "free" ? ", up to one per day" : ", up to 80 per month"}.</p>
        <button className="button" onClick={onPricing}>View plans<ArrowRight size={16} /></button>
        <a className="privacy-link" href="/security"><ShieldCheck size={15} />Privacy & data handling</a>
      </aside>
    </div>
  </section>;
}
