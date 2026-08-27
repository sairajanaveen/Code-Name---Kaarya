import Head from "next/head";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowLeft, ArrowRight, Check, CheckCircle2, ChevronDown, ClipboardCheck, Copy, Download, FileText, History, Loader2, LogIn, LogOut, Mail, MessageSquare, Mic, Plus, RefreshCw, Save, Send, ShieldCheck, Sparkles, Square, Trash2, Undo2, X } from "lucide-react";
import { assessNotes, MAX_TRANSCRIPT_LENGTH } from "../lib/meetingInput";
import { getAuthClient, authHeaders } from "../lib/browserAuth";
import { buildPostMeetingEmail, buildMeetingWhatsApp, plainTextToHtml, buildWhatsAppShareUrl } from "../lib/templates";
import { exampleInput, exampleOutput, createExampleReview } from "../lib/exampleMeeting";
import { readDraftResponse } from "../lib/clientFlow";

const blank = { source: "website", meeting_name: "", meeting_date: "", raw_notes: "", attendees: "", agenda: "", email: "", output_focus: "actions" };
const stages = { reading: "Reading your notes", extracting: "Finding decisions and commitments", checking: "Checking source quotes and dates", retrying: "Trying the backup processor" };
const dateToday = () => new Date().toLocaleDateString("en-CA");
const clone = (value) => JSON.parse(JSON.stringify(value));
const stripIds = (output) => ({ ...output, readiness_score: output.action_items.length ? Math.round(output.action_items.reduce((sum, task) => sum + (task.owner && task.owner !== "Unassigned" ? 1 : 0) + (task.due_date ? 1 : 0), 0) / (output.action_items.length * 2) * 100) : 0, action_items: output.action_items.map(({ id, update_token, last_nudged_at, ...task }) => task) });
const withIds = (output, previous = []) => ({ ...output, action_items: output.action_items.map((task) => ({ ...task, id: previous.find((old) => old.task === task.task)?.id || crypto.randomUUID() })) });

function ToolButton({ label, children, ...props }) {
  return <button type="button" className="icon-button" aria-label={label} title={label} {...props}>{children}</button>;
}
function Field({ label, children }) { return <label className="field"><span>{label}</span>{children}</label>; }
function GrowingTextarea(props) {
  const element = useRef(null);
  useEffect(() => {
    const node = element.current;
    if (!node) return;
    const fit = () => { node.style.height = "auto"; node.style.height = (node.scrollHeight + 2) + "px"; };
    fit();
    let width = node.getBoundingClientRect().width;
    const observer = new ResizeObserver(() => {
      const nextWidth = node.getBoundingClientRect().width;
      if (nextWidth !== width) { width = nextWidth; fit(); }
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [props.value]);
  return <textarea {...props} ref={element} style={{ overflow: "hidden", resize: "none" }} />;
}
async function api(url, body) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60000);
  try {
    const response = await fetch(url, { signal: controller.signal, method: body ? "POST" : "GET", headers: { "Content-Type": "application/json", ...await authHeaders() }, ...(body ? { body: JSON.stringify(body) } : {}) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "This request could not finish. Please retry.");
    return data;
  } catch (error) {
    if (controller.signal.aborted) throw new Error("This request timed out. Your draft is still here; check the destination before retrying a send.");
    throw error;
  } finally { clearTimeout(timeout); }
}
function csvCell(value) { return '"' + String(value || "").replace(/"/g, '""').replace(/^[=+\-@]/, "'$&") + '"'; }

export default function Kaarya() {
  const [form, setForm] = useState(blank);
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [view, setView] = useState("new");
  const [draft, setDraft] = useState(null);
  const [draftPayload, setDraftPayload] = useState(null);
  const [isExample, setIsExample] = useState(false);
  const [busy, setBusy] = useState("");
  const [stage, setStage] = useState("reading");
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [tab, setTab] = useState("actions");
  const [refine, setRefine] = useState("");
  const [undo, setUndo] = useState(null);
  const [dirty, setDirty] = useState(false);
  const [meetings, setMeetings] = useState([]);
  const [historyTasks, setHistoryTasks] = useState([]);
  const [integrations, setIntegrations] = useState({});
  const [historyBusy, setHistoryBusy] = useState(false);
  const [composer, setComposer] = useState(false);
  const [emailText, setEmailText] = useState("");
  const [recipient, setRecipient] = useState("");
  const [schedule, setSchedule] = useState("");
  const [sendLater, setSendLater] = useState(false);
  const [syncChannel, setSyncChannel] = useState("notion");
  const [recording, setRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [consent, setConsent] = useState(false);
  const [inputTouched, setInputTouched] = useState(false);
  const abortRef = useRef(null);
  const recorderRef = useRef(null);
  const streamRef = useRef(null);
  const audioLimitRef = useRef(null);
  const saveKey = useRef(null);
  const fileRef = useRef(null);
  const resultRef = useRef(null);
  const generatingRef = useRef(false);
  const sendingRef = useRef(false);
  const reduced = useReducedMotion();

  useEffect(() => {
    setForm((previous) => ({ ...previous, meeting_date: dateToday() }));
    try {
      const stored = sessionStorage.getItem("kaarya-intake");
      if (stored) { setForm(JSON.parse(stored)); sessionStorage.removeItem("kaarya-intake"); }
    } catch {}
    let active = true;
    let subscription;
    getAuthClient().then(async (auth) => {
      if (!active) return;
      if (!auth) { setAuthReady(true); return; }
      subscription = auth.auth.onAuthStateChange((event, session) => {
        if (!active) return;
        setUser(session?.user || null);
        if (event === "SIGNED_OUT") { setMeetings([]); setHistoryTasks([]); setDraft(null); setDirty(false); }
      }).data.subscription;
      const { data } = await auth.auth.getSession();
      if (active) { setUser(data.session?.user || null); setAuthReady(true); }
    }).catch(() => { if (active) { setAuthReady(true); setError("Your session could not be restored. Please sign in again."); } });
    return () => { active = false; subscription?.unsubscribe(); };
  }, []);

  useEffect(() => {
    if (!user) return;
    setRecipient(user.email || "");
    refreshHistory();
  }, [user?.id]);

  useEffect(() => {
    if (draft) resultRef.current?.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
  }, [draft?.meeting?.id]);

  useEffect(() => {
    if (!busy) return;
    const start = Date.now();
    setElapsed(0);
    const timer = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 1000);
    return () => clearInterval(timer);
  }, [busy]);

  useEffect(() => {
    if (!recording) return;
    const timer = setInterval(() => setRecordSeconds((seconds) => seconds + 1), 1000);
    return () => clearInterval(timer);
  }, [recording]);

  useEffect(() => () => {
    clearTimeout(audioLimitRef.current);
    if (recorderRef.current) recorderRef.current.onstop = null;
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    abortRef.current?.abort();
  }, []);

  useEffect(() => {
    const protect = (event) => { if ((dirty && !isExample) || busy) { event.preventDefault(); event.returnValue = ""; } };
    window.addEventListener("beforeunload", protect);
    return () => window.removeEventListener("beforeunload", protect);
  }, [dirty, busy, isExample]);

  async function refreshHistory() {
    setHistoryBusy(true);
    try {
      const [data, taskData] = await Promise.all([api("/api/dashboard/meetings"), api("/api/dashboard/tasks")]);
      setMeetings(data.meetings || []);
      setHistoryTasks(taskData.tasks || []);
      setIntegrations(data.integrations || {});
    } catch (err) { setError(err.message); }
    finally { setHistoryBusy(false); }
  }

  function update(key, value) { setForm((previous) => ({ ...previous, [key]: value })); setIsExample(false); }
  function notify(message) { setNotice(message); setError(""); }

  async function login() {
    setError("");
    try {
      const auth = await getAuthClient();
      if (!auth) { setError("Google sign-in is not configured yet. You can explore the example."); return; }
      sessionStorage.setItem("kaarya-intake", JSON.stringify(form));
      const { error: authError } = await auth.auth.signInWithOAuth({ provider: "google", options: { redirectTo: window.location.origin } });
      if (authError) throw authError;
    } catch { setError("Google sign-in could not start. Please try again."); }
  }

  async function generate(event) {
    event.preventDefault();
    if (generatingRef.current || busy || recording) return;
    setInputTouched(true); setError(""); setNotice("");
    const issue = assessNotes(form.raw_notes);
    if (issue) { setError(issue); return; }
    if (!isExample && !user) { setError("Sign in with Google to create a private meeting draft. Your notes will stay here."); return; }
    generatingRef.current = true;
    setBusy("generate"); setStage("reading");
    try {
      const payload = { ...form, meeting_name: form.meeting_name.trim() || "Meeting " + (form.meeting_date || dateToday()), meeting_date: form.meeting_date || dateToday(), review_before_send: true, destination_channels: ["dashboard"] };
      let data;
      if (isExample) data = { meeting: { id: crypto.randomUUID(), title: exampleInput.meeting_name, meeting_date: exampleInput.meeting_date }, structured: clone(exampleOutput), warnings: [], saved: false };
      else {
        abortRef.current = new AbortController();
        const response = await fetch("/api/meetings/submit", { method: "POST", signal: abortRef.current.signal, headers: { "Content-Type": "application/json", Accept: "application/x-ndjson", ...await authHeaders() }, body: JSON.stringify(payload) });
        data = await readDraftResponse(response, setStage);
      }
      setDraft({ ...data, structured: withIds(data.structured), revision: 0 });
      setDraftPayload(payload);
      setDirty(true); setUndo(null); setComposer(false); saveKey.current = null;
      setTab(payload.output_focus === "prep" ? "prep" : payload.output_focus === "decisions" ? "decisions" : "actions");
    } catch (err) { setError(err.name === "AbortError" ? "Processing cancelled. Your notes are unchanged." : err.message); }
    finally { setBusy(""); generatingRef.current = false; }
  }

  function editOutput(change) {
    if (busy) return;
    setUndo(clone(draft.structured));
    setDraft((previous) => ({ ...previous, structured: change(previous.structured) }));
    setDirty(true); setComposer(false); saveKey.current = null; setNotice("");
  }
  function editTask(id, key, value) {
    editOutput((output) => ({ ...output, action_items: output.action_items.map((task) => task.id === id ? { ...task, [key]: value } : task) }));
  }
  function undoEdit() {
    if (!undo || busy) return;
    setDraft((previous) => ({ ...previous, structured: undo }));
    setUndo(null); setDirty(true); saveKey.current = null; setComposer(false);
  }

  async function refineDraft(event) {
    event.preventDefault();
    if (!refine.trim() || busy) return;
    if (isExample) { notify("Example mode: edit the table directly. Sign in to refine your own meeting."); return; }
    setBusy("refine"); setError("");
    try {
      const data = await api("/api/refine", { instruction: refine, structured: stripIds(draft.structured), payload: draftPayload });
      setUndo(clone(draft.structured));
      setDraft((previous) => ({ ...previous, ...data, structured: withIds(data.structured, previous.structured.action_items) }));
      setDraftPayload((previous) => ({ ...previous, raw_notes: previous.raw_notes + "\nUser correction: " + refine }));
      setRefine(""); setDirty(true); setComposer(false); saveKey.current = null;
      notify("Changes applied. Review before sharing.");
    } catch (err) { setError(err.message); }
    finally { setBusy(""); }
  }

  async function saveDraft() {
    if (isExample) throw new Error("This is an example. Create your own meeting to save it.");
    if (!dirty && draft.saved) return draft;
    const id = saveKey.current || crypto.randomUUID();
    saveKey.current = id;
    const saved = await api("/api/meetings/save", {
      meeting: draft.meeting, structured: stripIds(draft.structured), action_ids: draft.structured.action_items.map((task) => task.id),
      revision: draft.revision || 0, save_id: id, source_notes: draftPayload?.raw_notes || ""
    });
    const next = { ...draft, saved: true, meeting: saved.meeting, revision: saved.meeting.draft_revision, structured: { ...draft.structured, action_items: draft.structured.action_items.map((task) => ({ ...task, update_token: saved.action_items.find((row) => row.id === task.id)?.update_token })) } };
    setDraft(next); setDirty(false);
    return next;
  }
  async function save() {
    if (busy) return;
    setBusy("save"); setError("");
    try { await saveDraft(); notify("Saved to your meeting history."); await refreshHistory(); }
    catch (err) { setError(err.message); }
    finally { setBusy(""); }
  }

  const reportText = () => buildPostMeetingEmail({ meeting: { ...draft.meeting, summary: draft.structured.summary }, tasks: draft.structured.action_items, prepQuestions: draft.structured.prep_questions });

  async function copy(kind) {
    try {
      const text = kind === "email" ? reportText() : buildMeetingWhatsApp({ meeting: draft.meeting, tasks: draft.structured.action_items });
      if (!navigator.clipboard) throw new Error("Clipboard access is unavailable. Open the email draft and select the text.");
      if (kind === "email" && window.ClipboardItem && navigator.clipboard.write) {
        try { await navigator.clipboard.write([new ClipboardItem({ "text/plain": new Blob([text], { type: "text/plain" }), "text/html": new Blob([plainTextToHtml(text)], { type: "text/html" }) })]); }
        catch { await navigator.clipboard.writeText(text); }
      } else await navigator.clipboard.writeText(text);
      notify(kind === "email" ? "Email copied." : "WhatsApp message copied.");
    } catch (err) { setError(err.message); }
  }
  function downloadCsv() {
    const rows = [["Action", "Owner", "Team", "Due", "Status", "Priority"], ...draft.structured.action_items.map((task) => [task.task, task.owner, task.team, task.due_date, task.status, task.priority])];
    const url = URL.createObjectURL(new Blob(["\uFEFF" + rows.map((row) => row.map(csvCell).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = "kaarya-actions.csv"; anchor.click(); URL.revokeObjectURL(url);
  }

  async function send(event) {
    event.preventDefault();
    if (sendingRef.current || busy) return;
    sendingRef.current = true; setBusy("send"); setError("");
    try {
      const saved = await saveDraft();
      const data = await api("/api/messages/send", { to: recipient, subject: "Actions from " + saved.meeting.title, text: emailText, meeting_id: saved.meeting.id, ...(sendLater ? { scheduled_at: new Date(schedule).toISOString() } : {}) });
      notify(data.warning || (data.status === "scheduled" ? "Email scheduled with the delivery provider." : "Email accepted by the delivery provider."));
      setComposer(false);
    } catch (err) { setError(err.message); }
    finally { setBusy(""); sendingRef.current = false; }
  }

  async function publish() {
    if (busy) return;
    setBusy("publish"); setError("");
    try {
      const saved = await saveDraft();
      await api("/api/meetings/publish", { meeting_id: saved.meeting.id, channel: syncChannel });
      notify("Reviewed output published to " + syncChannel + ".");
    } catch (err) { setError(err.message); }
    finally { setBusy(""); }
  }

  function loadExample() {
    if (busy || recording) return;
    if (dirty && !isExample && !window.confirm("Leave this unsaved draft?")) return;
    setDraft(createExampleReview());
    setDraftPayload({ ...blank, ...exampleInput });
    setIsExample(true); setDirty(false); setInputTouched(false); setError(""); setNotice("");
    setView("new"); setTab("actions"); setUndo(null); setComposer(false); setRefine(""); saveKey.current = null;
  }
  function newMeeting() {
    if (busy) return;
    if (dirty && !isExample && !window.confirm("Leave this unsaved draft?")) return;
    setDraft(null); setForm({ ...blank, meeting_date: dateToday() }); setIsExample(false); setView("new"); setDirty(false); setError(""); setNotice("");
  }
  async function openMeeting(selectedMeeting) {
    if (busy) return;
    if (dirty && !window.confirm("Leave this unsaved draft?")) return;
    setBusy("open"); setError("");
    try {
    const data = await api("/api/dashboard/tasks?meeting_id=" + encodeURIComponent(selectedMeeting.id));
    const meeting = data.meeting;
    const rows = data.tasks;
    const snapshot = meeting.output_snapshot || { summary: meeting.summary || "", language: meeting.language || "unknown", readiness_score: meeting.readiness_score || 0, action_items: [], prep_questions: [], decisions: [], blockers: [] };
    setDraft({ meeting, structured: { ...snapshot, action_items: rows.map((task) => ({ task: task.task, owner: task.owner || "Unassigned", team: task.team || "", due_date: task.due_date || "", status: task.status, priority: task.priority, evidence: task.evidence || "", id: task.id, update_token: task.update_token, last_nudged_at: task.last_nudged_at })) }, saved: true, revision: meeting.draft_revision || 0, warnings: [] });
    setDraftPayload({ ...blank, meeting_name: meeting.title, meeting_date: meeting.meeting_date, raw_notes: meeting.source_notes || "" });
    setView("new"); setTab("actions"); setIsExample(false); setDirty(false); setUndo(null); setComposer(false); setError(""); setNotice(""); saveKey.current = null;
    } catch (err) { setError(err.message); }
    finally { setBusy(""); }
  }

  async function importTranscript(event) {
    const file = event.target.files?.[0]; event.target.value = "";
    if (!file) return;
    if (!/\.(txt|md|vtt|srt)$/i.test(file.name) || file.size > 400000) { setError("Choose a TXT, Markdown, VTT or SRT transcript smaller than 400 KB."); return; }
    const text = await file.text();
    if (text.length > MAX_TRANSCRIPT_LENGTH) { setError("This transcript exceeds 100,000 characters. Split it into sections; nothing has been imported."); return; }
    update("raw_notes", text); setError("");
  }

  async function record() {
    if (recording) { recorderRef.current?.stop(); return; }
    if (!user) { setError("Sign in before recording a voice note."); return; }
    if (!consent) { setError("Confirm recording consent first."); return; }
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") { setError("Recording is not supported in this browser. Paste or import your notes."); return; }
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true }); streamRef.current = stream;
      const mimeType = ["audio/webm", "audio/mp4", "audio/ogg"].find((type) => MediaRecorder.isTypeSupported(type));
      if (!mimeType) { stream.getTracks().forEach((track) => track.stop()); throw new Error("This browser's recording format is not supported."); }
      const recorder = new MediaRecorder(stream, { mimeType });
      const chunks = []; const started = Date.now(); recorderRef.current = recorder;
      recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };
      recorder.onerror = () => { stream.getTracks().forEach((track) => track.stop()); clearTimeout(audioLimitRef.current); setRecording(false); setError("Recording stopped unexpectedly. Please retry."); };
      recorder.onstop = async () => {
        clearTimeout(audioLimitRef.current); stream.getTracks().forEach((track) => track.stop()); setRecording(false); setBusy("transcribe");
        try {
          const blob = new Blob(chunks, { type: mimeType });
          const base64 = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result).split(",")[1]); reader.onerror = reject; reader.readAsDataURL(blob); });
          const data = await api("/api/audio/transcribe", { base64, mimeType, duration: Math.min(30, (Date.now() - started) / 1000) });
          setForm((previous) => ({ ...previous, raw_notes: [previous.raw_notes, data.transcript].filter(Boolean).join("\n") })); setIsExample(false); notify("Voice note transcribed. Check the text before continuing.");
        } catch (err) { setError(err.message); }
        finally { setBusy(""); }
      };
      setRecordSeconds(0); setRecording(true); recorder.start();
      audioLimitRef.current = setTimeout(() => { if (recorder.state === "recording") recorder.stop(); }, 29000);
    } catch (err) {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      setError(err.name === "NotAllowedError" ? "Microphone access was denied. Allow it in your browser or paste your notes." : err.message);
    }
  }

  const output = draft?.structured;
  const tasks = output?.action_items || [];
  const missing = tasks.filter((task) => !task.owner || task.owner === "Unassigned" || !task.due_date).length;
  const readiness = tasks.length ? Math.round(tasks.reduce((sum, task) => sum + (task.owner && task.owner !== "Unassigned" ? 1 : 0) + (task.due_date ? 1 : 0), 0) / (tasks.length * 2) * 100) : 0;
  const blocked = historyTasks.filter((task) => task.status === "blocked").length;
  const open = historyTasks.filter((task) => task.status !== "done").length;
  const inputIssue = inputTouched ? assessNotes(form.raw_notes) : "";

  return <div className="kaarya-app">
    <Head><title>Kaarya | Meeting workspace</title><meta name="description" content="Review decisions, assign action items and prepare your next meeting." /></Head>
    <header className="app-header">
      <button className="brand" onClick={() => setView("new")} aria-label="Kaarya workspace"><span className="brand-mark"><ClipboardCheck size={21} /></span>Kaarya<span className="workspace-label">Workspace</span></button>
      <nav className="top-tabs" aria-label="Workspace"><button aria-current={view === "new" ? "page" : undefined} onClick={() => setView("new")}><FileText size={16} /><span>Meeting</span></button><button aria-current={view === "history" ? "page" : undefined} onClick={() => { setView("history"); if (user) refreshHistory(); }}><History size={16} /><span>History</span></button></nav>
      {user ? <div className="account"><span title={user.email}>{user.user_metadata?.full_name?.split(" ")[0] || "My account"}</span><ToolButton label="Sign out" onClick={() => { if (!dirty || window.confirm("Sign out and leave this unsaved draft?")) getAuthClient().then((auth) => auth?.auth.signOut()); }}><LogOut size={17} /></ToolButton></div> : <button className="button sign-in" onClick={login} disabled={!authReady}><LogIn size={16} /><span>Sign in with Google</span></button>}
    </header>
    <main className="workspace">
      {(error || notice) && <div className={"feedback " + (error ? "error" : "success")} role={error ? "alert" : "status"}><span>{error || notice}</span><ToolButton label="Dismiss message" onClick={() => { setError(""); setNotice(""); }}><X size={16} /></ToolButton></div>}
      {view === "history" ? <section>
        <div className="section-heading"><div><p className="eyebrow">Your workspace</p><h1>Meeting history</h1></div><button className="button primary" onClick={newMeeting}><Plus size={17} />New meeting</button></div>
        {!user ? <div className="empty-state"><ShieldCheck size={30} /><h2>Your meetings, in one place.</h2><div className="button-row"><button className="button primary" onClick={login}><LogIn size={16} />Sign in with Google</button><button className="button" onClick={loadExample}><Sparkles size={16} />Try an example</button></div></div> : <>
          <div className="history-stats"><div><strong>{meetings.length}</strong><span>Recent meetings</span></div><div><strong>{open}</strong><span>Recent open actions</span></div><div><strong>{blocked}</strong><span>Blocked</span></div><ToolButton label="Refresh history" onClick={refreshHistory} disabled={historyBusy}><RefreshCw size={18} className={historyBusy ? "spin" : ""} /></ToolButton></div>
          {historyBusy && !meetings.length ? <p role="status">Loading your meetings...</p> : !meetings.length ? <div className="empty-state"><History size={28} /><h2>No saved meetings yet.</h2><button className="button" onClick={newMeeting}>New meeting<ArrowRight size={16} /></button></div> : <div className="meeting-list" aria-busy={busy === "open"}>{busy === "open" && <p role="status">Opening meeting...</p>}{meetings.map((meeting) => <button className="meeting-row" key={meeting.id} disabled={Boolean(busy)} onClick={() => openMeeting(meeting)}><FileText size={21} /><span><strong>{meeting.title}</strong><small>{meeting.meeting_date} · {meeting.status === "reviewed" ? "Reviewed" : "Saved meeting"}</small></span><ArrowRight size={17} /></button>)}</div>}
        </>}
      </section> : !draft ? <section className="intake-layout">
        <div className="intake-main">
          <div className="section-heading"><div><p className="eyebrow">01 / Capture</p><h1>New meeting</h1></div><button className="button subtle" onClick={loadExample} disabled={Boolean(busy) || recording}><Sparkles size={16} />Try an example</button></div>
          <form onSubmit={generate}>
            <div className="notes-heading"><label htmlFor="meeting-notes">Meeting notes</label><span className={"badge " + (isExample ? "amber" : "")}>{isExample ? "Example" : "Not shared"}</span></div>
            <textarea id="meeting-notes" className="notes-input" placeholder="Asha will send the client proposal tomorrow. Vendor approval is still blocked..." value={form.raw_notes} onChange={(event) => update("raw_notes", event.target.value)} onBlur={() => setInputTouched(true)} disabled={Boolean(busy)} aria-invalid={Boolean(inputIssue)} aria-describedby={inputIssue ? "input-error" : undefined} />
            {inputIssue && <p id="input-error" className="field-error">{inputIssue}</p>}
            <div className="capture-toolbar"><div><button type="button" className={"button subtle " + (recording ? "recording" : "")} onClick={record} disabled={Boolean(busy)}>{recording ? <Square size={15} /> : <Mic size={16} />}{recording ? "Stop " + recordSeconds + "s" : "Voice note"}</button><button type="button" className="button subtle" onClick={() => fileRef.current.click()} disabled={Boolean(busy) || recording}><FileText size={16} />Import text</button><input hidden type="file" ref={fileRef} accept=".txt,.md,.vtt,.srt" onChange={importTranscript} /></div><span className="character-count">{form.raw_notes.length.toLocaleString()} / 100k</span></div>
            <label className="consent"><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} />I have consent to record. <span>30-second voice note</span></label>
            <details className="context-fields"><summary>Meeting details <span>Optional</span><ChevronDown size={16} /></summary><div className="field-grid"><Field label="Meeting name"><input maxLength={180} value={form.meeting_name} onChange={(event) => update("meeting_name", event.target.value)} placeholder="Client launch review" /></Field><Field label="Meeting date"><input type="date" value={form.meeting_date} onChange={(event) => update("meeting_date", event.target.value)} required /></Field><Field label="People involved"><input maxLength={1200} value={form.attendees} onChange={(event) => update("attendees", event.target.value)} placeholder="Asha, Rohan, Priya" /></Field><Field label="Meeting outcome"><input maxLength={2000} value={form.agenda} onChange={(event) => update("agenda", event.target.value)} placeholder="Approve the pilot launch" /></Field></div></details>
            <fieldset className="focus-selector"><legend>Focus</legend><div className="segments">{[["actions", "Action items"], ["decisions", "Decisions"], ["prep", "Next meeting"]].map(([value, label]) => <button key={value} type="button" aria-pressed={form.output_focus === value} onClick={() => update("output_focus", value)} disabled={Boolean(busy)}>{label}</button>)}</div></fieldset>
            {busy ? <div className="processing" role="status" aria-live="polite"><Loader2 size={20} className="spin" /><div><strong>{busy === "transcribe" ? "Transcribing your voice note" : stages[stage]}</strong><span>{elapsed}s elapsed{elapsed > 20 ? " · Still working. Your notes are safe in this tab." : ""}</span></div>{busy === "generate" && <ToolButton label="Cancel processing" onClick={() => abortRef.current?.abort()}><X size={17} /></ToolButton>}</div> : <button className="button primary generate" type="submit" disabled={recording}><Sparkles size={18} />Create action draft<ArrowRight size={18} /></button>}
          </form>
        </div>
        <aside className="intake-aside"><p className="eyebrow">Conversation to accountability</p><ol className="journey"><li className="active"><span>1</span><div><strong>Capture</strong><small>Notes and commitments</small></div></li><li><span>2</span><div><strong>Review</strong><small>Owners, dates, evidence</small></div></li><li><span>3</span><div><strong>Share</strong><small>Approved actions</small></div></li></ol><div className="aside-note"><ClipboardCheck size={23} /><h2>Every action needs<br />a next step.</h2><div className="sample-row"><span className="sample-check"><Check size={13} /></span><span>Send the client proposal<small>Asha · Tomorrow</small></span><span className="badge">Pending</span></div></div><a href="/security" className="privacy-link"><ShieldCheck size={15} />Privacy and data handling<ArrowRight size={14} /></a></aside>
      </section> : <motion.section ref={resultRef} initial={reduced ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22 }}>
        <div className="section-heading review-heading"><div><p className="eyebrow">02 / Review {isExample && "· Example"}</p><h1>{draft.meeting.title}</h1><span className="review-meta">{draft.meeting.meeting_date} · {isExample ? "Example, not saved" : dirty ? "Unsaved draft" : "Saved"}{draft.processing ? " · Draft in " + (draft.processing.duration_ms / 1000).toFixed(1) + "s" : ""}</span></div><div className="button-row"><ToolButton label="Undo last edit" disabled={!undo || Boolean(busy)} onClick={undoEdit}><Undo2 size={17} /></ToolButton><button className="button" onClick={newMeeting} disabled={Boolean(busy)}><Plus size={16} />New meeting</button><button className="button primary" onClick={save} disabled={Boolean(busy) || isExample || (!dirty && draft.saved)}>{busy === "save" ? <Loader2 size={16} className="spin" /> : <Save size={16} />}{draft.saved && !dirty ? "Saved" : "Save review"}</button></div></div>
        <div className="review-stats"><span><strong>{tasks.length}</strong> actions</span><span className={missing ? "attention" : "positive"}>{missing ? missing + " need an owner or date" : "Owners and dates complete"}</span><span title="Share of action owner and due-date fields completed. Not a meeting productivity or accuracy score.">Action completeness <strong>{readiness}%</strong></span></div>
        {draft.warnings?.length > 0 && <div className="review-warning" role="status">{draft.warnings.join(" ")}</div>}
        <div className="output-tabs" role="tablist" aria-label="Meeting output">{[["actions", "Action items", tasks.length], ["decisions", "Summary & decisions", output.decisions.length], ["prep", "Next meeting", output.prep_questions.length]].map(([value, label, count]) => <button key={value} id={"tab-" + value} role="tab" aria-selected={tab === value} aria-controls="output-panel" tabIndex={tab === value ? 0 : -1} onKeyDown={(event) => { const order = ["actions", "decisions", "prep"]; const index = order.indexOf(tab); const target = event.key === "ArrowRight" ? order[(index + 1) % 3] : event.key === "ArrowLeft" ? order[(index + 2) % 3] : event.key === "Home" ? order[0] : event.key === "End" ? order[2] : null; if (target) { event.preventDefault(); setTab(target); document.getElementById("tab-" + target)?.focus(); } }} onClick={() => setTab(value)}>{label}<span>{count}</span></button>)}</div>
        <div role="tabpanel" id="output-panel" aria-labelledby={"tab-" + tab}>
        {tab === "actions" ? <>
          {tasks.length ? <div className="action-table"><table><thead><tr><th>Action / evidence</th><th>Owner / team</th><th>Due</th><th>Status / priority</th><th><span className="sr-only">Tools</span></th></tr></thead><tbody>{tasks.map((task, index) => <tr key={task.id}><td><GrowingTextarea aria-label={"Action " + (index + 1)} value={task.task} maxLength={260} rows={2} onChange={(event) => editTask(task.id, "task", event.target.value)} disabled={Boolean(busy)} /><details className="evidence"><summary>Source quote</summary><p>{task.evidence || "Added during review."}</p></details></td><td><input aria-label={"Owner " + (index + 1)} className={!task.owner || task.owner === "Unassigned" ? "missing" : ""} maxLength={120} value={task.owner} onChange={(event) => editTask(task.id, "owner", event.target.value)} placeholder="Unassigned" disabled={Boolean(busy)} /><input aria-label={"Team " + (index + 1)} maxLength={120} value={task.team} onChange={(event) => editTask(task.id, "team", event.target.value)} placeholder="Team" disabled={Boolean(busy)} /></td><td><input aria-label={"Due date " + (index + 1)} type="date" className={!task.due_date ? "missing" : ""} value={task.due_date} onChange={(event) => editTask(task.id, "due_date", event.target.value)} disabled={Boolean(busy)} /></td><td><select aria-label={"Status " + (index + 1)} value={task.status} onChange={(event) => editTask(task.id, "status", event.target.value)} disabled={Boolean(busy)}>{[["pending", "Pending"], ["in_progress", "In progress"], ["blocked", "Blocked"], ["done", "Done"]].map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><select aria-label={"Priority " + (index + 1)} value={task.priority} onChange={(event) => editTask(task.id, "priority", event.target.value)} disabled={Boolean(busy)}>{["Low", "Medium", "High"].map((priority) => <option key={priority}>{priority}</option>)}</select></td><td><ToolButton label={"Remove action " + (index + 1)} onClick={() => editOutput((current) => ({ ...current, action_items: current.action_items.filter((item) => item.id !== task.id) }))} disabled={Boolean(busy)}><Trash2 size={16} /></ToolButton>{task.update_token && !dirty && <a className="task-link" href={"/task/" + task.update_token} target="_blank" rel="noreferrer">Update link</a>}<small className="last-nudge">{task.last_nudged_at ? "Last nudge: " + new Date(task.last_nudged_at).toLocaleDateString() : "No nudge sent"}</small></td></tr>)}</tbody></table></div> : <div className="empty-state"><CheckCircle2 size={28} /><h2>No agreed actions found.</h2><p>Review the decisions or add a confirmed next step.</p></div>}
          <button className="button subtle add-action" disabled={Boolean(busy) || tasks.length >= 24} onClick={() => editOutput((current) => ({ ...current, action_items: [...current.action_items, { id: crypto.randomUUID(), task: "", owner: "Unassigned", team: "", due_date: "", status: "pending", priority: "Medium", evidence: "" }] }))}><Plus size={16} />Add action</button>
        </> : tab === "decisions" ? <div className="summary-panel"><Field label="Summary"><textarea value={output.summary} rows={3} maxLength={900} disabled={Boolean(busy)} onChange={(event) => editOutput((current) => ({ ...current, summary: event.target.value }))} /></Field><div className="two-columns"><div><h2>Decisions</h2>{output.decisions.length ? output.decisions.map((decision, index) => <GrowingTextarea aria-label={"Decision " + (index + 1)} key={index} value={decision} maxLength={300} rows={2} disabled={Boolean(busy)} onChange={(event) => editOutput((current) => ({ ...current, decisions: current.decisions.map((item, i) => i === index ? event.target.value : item) }))} />) : <p>No explicit decisions captured.</p>}</div><div><h2>Blockers</h2>{output.blockers.length ? output.blockers.map((blocker, index) => <GrowingTextarea aria-label={"Blocker " + (index + 1)} key={index} value={blocker} maxLength={300} rows={2} disabled={Boolean(busy)} onChange={(event) => editOutput((current) => ({ ...current, blockers: current.blockers.map((item, i) => i === index ? event.target.value : item) }))} />) : <p>No blockers captured.</p>}</div></div></div> : <div className="prep-panel">{output.prep_questions.length ? output.prep_questions.map((question, index) => <div className="prep-row" key={index}><span className="question-number">{String(index + 1).padStart(2, "0")}</span><div><input aria-label={"Question owner " + (index + 1)} value={question.intended_owner} maxLength={120} disabled={Boolean(busy)} onChange={(event) => editOutput((current) => ({ ...current, prep_questions: current.prep_questions.map((item, i) => i === index ? { ...item, intended_owner: event.target.value } : item) }))} /><GrowingTextarea aria-label={"Prep question " + (index + 1)} value={question.question} rows={2} maxLength={260} disabled={Boolean(busy)} onChange={(event) => editOutput((current) => ({ ...current, prep_questions: current.prep_questions.map((item, i) => i === index ? { ...item, question: event.target.value } : item) }))} /><p>{question.reason}</p></div><ToolButton label={"Remove question " + (index + 1)} disabled={Boolean(busy)} onClick={() => editOutput((current) => ({ ...current, prep_questions: current.prep_questions.filter((_, i) => i !== index) }))}><X size={17} /></ToolButton></div>) : <div className="empty-state"><CheckCircle2 size={26} /><h2>No unresolved questions captured.</h2></div>}</div>}
        </div>
        <form className="refine-form" onSubmit={refineDraft}><MessageSquare size={20} /><input aria-label="Refine this draft" placeholder="What needs changing? e.g. Priya owns vendor approval, due Monday." value={refine} onChange={(event) => setRefine(event.target.value)} maxLength={2000} disabled={Boolean(busy) || !draftPayload?.raw_notes} /><button className="button" aria-label="Refine draft" title="Refine draft" disabled={Boolean(busy) || !refine.trim()}>{busy === "refine" ? <Loader2 size={16} className="spin" /> : <ArrowRight size={16} />}<span>Refine</span></button></form>
        <section className="share-section"><div className="section-heading"><div><p className="eyebrow">03 / Share</p><h2>Ready when you are.</h2></div><span className="badge">Review before sending</span></div><div className="share-controls"><button className="button" onClick={() => copy("email")}><Copy size={16} />Copy email</button><button className="button" onClick={() => copy("whatsapp")}><MessageSquare size={16} />Copy WhatsApp</button><ToolButton label="Download action items as CSV" onClick={downloadCsv}><Download size={18} /></ToolButton><button className="button primary" disabled={Boolean(busy) || isExample} onClick={() => { setEmailText(reportText()); setComposer(true); setSendLater(false); }}><Mail size={16} />Review email</button></div>
          <details className="other-channels"><summary>Connected channels<ChevronDown size={15} /></summary><div className="button-row"><select aria-label="Delivery channel" value={syncChannel} onChange={(event) => setSyncChannel(event.target.value)}>{["notion", "teams", "slack"].map((channel) => <option key={channel} value={channel}>{channel[0].toUpperCase() + channel.slice(1)}{integrations[channel] ? "" : " (not configured)"}</option>)}</select><button className="button" onClick={publish} disabled={Boolean(busy) || isExample || !integrations[syncChannel]}><Send size={15} />Publish reviewed output</button></div></details>
        </section>
        <AnimatePresence>{composer && <motion.form className="email-composer" onSubmit={send} initial={reduced ? false : { opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}><div className="section-heading"><h2>Email draft</h2><ToolButton label="Close email draft" onClick={() => setComposer(false)} disabled={Boolean(busy)}><X size={18} /></ToolButton></div><Field label="To"><input type="email" multiple required value={recipient} onChange={(event) => setRecipient(event.target.value)} disabled={Boolean(busy)} /></Field><Field label="Message"><textarea rows={12} value={emailText} onChange={(event) => setEmailText(event.target.value)} maxLength={30000} disabled={Boolean(busy)} /></Field><div className="email-footer"><label className="consent"><input type="checkbox" checked={sendLater} onChange={(event) => setSendLater(event.target.checked)} disabled={Boolean(busy)} />Send later</label>{sendLater && <Field label="Delivery time (your local time)"><input type="datetime-local" required value={schedule} onChange={(event) => setSchedule(event.target.value)} disabled={Boolean(busy)} /></Field>}<button type="submit" className="button primary" disabled={Boolean(busy)}>{busy === "send" ? <Loader2 size={16} className="spin" /> : <Send size={16} />}{sendLater ? "Schedule email" : "Send approved email"}</button></div></motion.form>}</AnimatePresence>
      </motion.section>}
    </main>
    <footer className="app-footer"><span>Kaarya</span><a href="/security">Privacy & data</a><span>Conversations into accountability.</span></footer>
  </div>;
}
