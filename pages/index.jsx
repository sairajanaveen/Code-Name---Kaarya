import Head from "next/head";
import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowLeft, ArrowRight, Check, CheckCircle2, ChevronDown, ClipboardCheck, Copy, Download, FileText, History, Loader2, LogIn, LogOut, Mail, MessageSquare, Mic, Plus, RefreshCw, Save, Send, ShieldCheck, Sparkles, Square, Trash2, Undo2, X } from "lucide-react";
import { assessNotes, MAX_TRANSCRIPT_BYTES, DIRECT_TRANSCRIPT_LENGTH } from "../lib/meetingInput";
import { getAuthClient, authHeaders } from "../lib/browserAuth";
import { buildPostMeetingEmail, buildMeetingWhatsApp, plainTextToHtml, buildWhatsAppShareUrl } from "../lib/templates";
import { exampleInput, exampleOutput, createExampleReview } from "../lib/exampleMeeting";
import { readDraftResponse } from "../lib/clientFlow";
import AccountPanel from "../components/AccountPanel";
import PricingContent from "../components/PricingContent";
import { PLANS } from "../lib/plans";
import ShareDraft from "../components/ShareDraft";
import MeetingMinutes from "../components/MeetingMinutes";
import IntakePreview from "../components/IntakePreview";
import { runTranscriptJob } from "../lib/clientJobs";
import { saveIntakeTransfer, takeIntakeTransfer } from "../lib/browserDraft";
import { composeLink } from "../lib/shareLinks";
import { withActionIds } from "../lib/meetingReview";
import PageControls, { REVIEW_PAGE_SIZE } from "../components/PageControls";

const blank = { source: "website", meeting_name: "", meeting_date: "", raw_notes: "", attendees: "", agenda: "", email: "", output_focus: "actions" };
const stages = { uploading: "Saving your transcript", reading: "Reading your notes", extracting: "Preparing minutes and action items", checking: "Checking source quotes and dates", retrying: "Trying the backup processor" };
const dateToday = () => new Date().toLocaleDateString("en-CA");
const clone = (value) => JSON.parse(JSON.stringify(value));
const stripIds = (output) => ({ ...output, readiness_score: output.action_items.length ? Math.round(output.action_items.reduce((sum, task) => sum + (task.owner && task.owner !== "Unassigned" ? 1 : 0) + (task.due_date ? 1 : 0), 0) / (output.action_items.length * 2) * 100) : 0, action_items: output.action_items.map(({ id, update_token, last_nudged_at, ...task }) => task) });
const withIds = withActionIds;

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
async function api(url, body, method, extraHeaders = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60000);
  try {
    const response = await fetch(url, { signal: controller.signal, method: method || (body ? "POST" : "GET"), headers: { "Content-Type": "application/json", ...await authHeaders(), ...extraHeaders }, ...(body ? { body: JSON.stringify(body) } : {}) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "This request could not finish. Please retry.");
    return data;
  } catch (error) {
    if (controller.signal.aborted) throw new Error("This request timed out. Your draft is still here; check the destination before retrying a send.");
    throw error;
  } finally { clearTimeout(timeout); }
}
async function jobRequest(url, body, method, signal) {
  const response = await fetch(url, { method, signal: AbortSignal.any([signal, AbortSignal.timeout(65000)].filter(Boolean)), headers: { "Content-Type": "application/json", ...await authHeaders() }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Processing paused. Resume to continue from the last saved section.");
  return data;
}
function csvCell(value) { return '"' + String(value || "").replace(/"/g, '""').replace(/^[=+\-@]/, "'$&") + '"'; }

export default function Kaarya() {
  const [form, setForm] = useState(blank);
  const [user, setUser] = useState(null);
  const [account, setAccount] = useState(null);
  const [nextOffset, setNextOffset] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
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
  const [actionPage, setActionPage] = useState(0);
  const [prepPage, setPrepPage] = useState(0);
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
  const [shareChannel, setShareChannel] = useState(null);
  const [activeJob, setActiveJob] = useState(null);
  const [jobProgress, setJobProgress] = useState(null);
  const [showRecording, setShowRecording] = useState(false);
  const abortRef = useRef(null);
  const recorderRef = useRef(null);
  const streamRef = useRef(null);
  const audioLimitRef = useRef(null);
  const saveKey = useRef(null);
  const generationKey = useRef(null);
  const refinementKey = useRef(null);
  const identityRef = useRef(null);
  const deleteDialog = useRef(null);
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
    takeIntakeTransfer().then((stored) => { if (stored) setForm(stored); }).catch(() => {});
    let active = true;
    let subscription;
    getAuthClient().then(async (auth) => {
      if (!active) return;
      if (!auth) { setAuthReady(true); return; }
      subscription = auth.auth.onAuthStateChange((event, session) => {
        if (!active) return;
        const previousOwner = identityRef.current;
        identityRef.current = session?.user?.id || null;
        setUser(session?.user || null);
        if (event === "SIGNED_OUT" || (previousOwner && previousOwner !== identityRef.current)) {
          abortRef.current?.abort();
          clearTimeout(audioLimitRef.current);
          if (recorderRef.current) recorderRef.current.onstop = null;
          if (recorderRef.current?.state === "recording") recorderRef.current.stop();
          streamRef.current?.getTracks().forEach((track) => track.stop());
          setMeetings([]); setHistoryTasks([]); setAccount(null); setDraft(null); setDraftPayload(null);
          setForm({ ...blank, meeting_date: dateToday() }); setUndo(null); setRefine(""); setEmailText(""); setRecipient("");
          setDirty(false); setDeleteTarget(null); setComposer(false); setRecording(false); setBusy(""); setNotice(""); setError("");
          setView("new"); setNextOffset(null); setIntegrations({}); setIsExample(false);
          setActiveJob(null); setJobProgress(null); setShareChannel(null);
          generationKey.current = null; refinementKey.current = null; saveKey.current = null;
        }
      }).data.subscription;
      const { data } = await auth.auth.getSession();
      if (active) { identityRef.current = data.session?.user?.id || null; setUser(data.session?.user || null); setAuthReady(true); }
    }).catch(() => { if (active) { setAuthReady(true); setError("Your session could not be restored. Please sign in again."); } });
    return () => { active = false; subscription?.unsubscribe(); };
  }, []);

  useEffect(() => {
    if (!user) return;
    setRecipient(user.email || "");
    refreshHistory();
    refreshAccount();
    refreshJobs();
  }, [user?.id]);

  useEffect(() => {
    if (deleteTarget && deleteDialog.current && !deleteDialog.current.open) deleteDialog.current.showModal();
  }, [deleteTarget]);

  useEffect(() => {
    if (draft) resultRef.current?.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
    setActionPage(0); setPrepPage(0);
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

  async function refreshAccount() {
    const owner = identityRef.current;
    try { const data = await api("/api/account"); if (identityRef.current === owner) setAccount(data); }
    catch (err) { if (identityRef.current === owner) setError(err.message); }
  }
  async function refreshJobs() {
    const owner = identityRef.current;
    try { const data = await api("/api/meetings/jobs"); if (identityRef.current === owner) setActiveJob(data.job); }
    catch (err) { if (identityRef.current === owner) setError(err.message); }
  }

  async function refreshHistory(offset = 0) {
    const owner = identityRef.current;
    setHistoryBusy(true);
    try {
      const [data, taskData] = await Promise.all([api("/api/dashboard/meetings?offset=" + offset), api("/api/dashboard/tasks")]);
      if (identityRef.current !== owner) return;
      setMeetings((previous) => offset ? [...previous, ...(data.meetings || []).filter((meeting) => !previous.some((old) => old.id === meeting.id))] : data.meetings || []);
      setNextOffset(data.next_offset);
      setHistoryTasks(taskData.tasks || []);
      setIntegrations(data.integrations || {});
    } catch (err) { if (identityRef.current === owner) setError(err.message); }
    finally { setHistoryBusy(false); }
  }

  async function saveProfile(fields) {
    const owner = identityRef.current;
    setBusy("profile"); setError("");
    try { const data = await api("/api/account", fields, "PATCH"); if (identityRef.current !== owner) return; setAccount(data); notify("Profile saved."); }
    catch (err) { setError(err.message); }
    finally { setBusy(""); }
  }

  async function exportMeeting(meeting) {
    const owner = identityRef.current;
    setBusy("export"); setError("");
    try {
      const data = await api("/api/meetings/" + meeting.id);
      if (identityRef.current !== owner) return;
      if (data.meeting.status === "reviewed" && data.meeting.output_snapshot) data.meeting.output_snapshot.action_items = data.tasks;
      if (data.source_included === false) {
        const parts = []; let offset = 0;
        do {
          const part = await api("/api/meetings/" + meeting.id + "/source?offset=" + offset);
          if (identityRef.current !== owner) return;
          parts.push(part.text); offset = part.next_offset;
        } while (offset !== null);
        data.meeting.source_notes = parts.join(""); data.source_included = true;
      }
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
      const link = document.createElement("a"); link.href = url; link.download = "kaarya-meeting-" + meeting.meeting_date + ".json"; link.click(); URL.revokeObjectURL(url);
      notify("Meeting exported.");
    } catch (err) { setError(err.message); }
    finally { setBusy(""); }
  }

  async function deleteMeeting() {
    if (!deleteTarget || busy) return;
    const owner = identityRef.current;
    setBusy("delete"); setError("");
    try {
      await api("/api/meetings/" + deleteTarget.id, null, "DELETE", { "x-kaarya-confirm-delete": deleteTarget.id });
      if (identityRef.current !== owner) return;
      if (draft?.meeting.id === deleteTarget.id) { setDraft(null); setDirty(false); }
      setDeleteTarget(null); notify("Meeting deleted. Its task links are no longer active.");
      await refreshHistory(); await refreshAccount();
    } catch (err) { setDeleteTarget(null); setError(err.message); }
    finally { setBusy(""); }
  }

  function update(key, value) { setForm((previous) => ({ ...previous, [key]: value })); setIsExample(false); }
  function notify(message) { setNotice(message); setError(""); }

  async function login() {
    setError("");
    try {
      const auth = await getAuthClient();
      if (!auth) { setError("Google sign-in is not configured yet. You can explore the example."); return; }
      await saveIntakeTransfer(form);
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
    const owner = identityRef.current;
    setBusy("generate"); setStage("reading");
    try {
      const payload = { ...form, language_hint: account?.profile?.language || "", meeting_name: form.meeting_name.trim() || "Meeting " + (form.meeting_date || dateToday()), meeting_date: form.meeting_date || dateToday(), review_before_send: true, destination_channels: ["dashboard"] };
      let data;
      if (isExample) data = { meeting: { id: crypto.randomUUID(), title: exampleInput.meeting_name, meeting_date: exampleInput.meeting_date }, structured: clone(exampleOutput), warnings: [], saved: false };
      else {
        abortRef.current = new AbortController();
        const fingerprint = JSON.stringify(payload);
        if (generationKey.current?.fingerprint !== fingerprint) generationKey.current = { fingerprint, id: crypto.randomUUID() };
        if (payload.raw_notes.length > DIRECT_TRANSCRIPT_LENGTH) {
          data = await runTranscriptJob({ payload, requestId: generationKey.current.id, request: jobRequest, signal: abortRef.current.signal,
            onProgress: (progress) => { if (identityRef.current === owner) { setActiveJob(progress); setJobProgress(progress); setStage(progress.stage); } } });
          setActiveJob(null);
        } else {
          const response = await fetch("/api/meetings/submit", { method: "POST", signal: abortRef.current.signal, headers: { "Content-Type": "application/json", Accept: "application/x-ndjson", ...await authHeaders() }, body: JSON.stringify({ ...payload, request_id: generationKey.current.id }) });
          data = await readDraftResponse(response, (next) => { if (identityRef.current === owner) setStage(next); });
        }
      }
      if (identityRef.current !== owner) return;
      setDraft({ ...data, structured: withIds(data.structured), revision: 0 });
      setDraftPayload(payload);
      setDirty(true); setUndo(null); setComposer(false); saveKey.current = null;
      setTab(payload.output_focus === "prep" ? "prep" : payload.output_focus === "decisions" ? "decisions" : "actions");
    } catch (err) { if (identityRef.current === owner) setError(err.name === "AbortError" ? "Processing paused. Any section already running will finish saving. Your notes are unchanged." : err.message); }
    finally { setBusy(""); generatingRef.current = false; if (user && !isExample && identityRef.current === owner) { refreshAccount(); refreshHistory(); refreshJobs(); } }
  }

  async function resumeJob() {
    if (!activeJob || busy) return;
    const owner = identityRef.current;
    setBusy("generate"); setError(""); abortRef.current = new AbortController();
    try {
      const data = await runTranscriptJob({ payload: form, resumeId: activeJob.id, request: jobRequest, signal: abortRef.current.signal,
        onProgress: (progress) => { if (identityRef.current === owner) { setJobProgress(progress); setStage(progress.stage); } } });
      if (identityRef.current !== owner) return;
      if (activeJob.kind === "refine") {
        const recovered = await api("/api/dashboard/tasks?meeting_id=" + activeJob.meeting_id);
        setDraft({ ...data, meeting: recovered.meeting, structured: withIds(data.structured, recovered.tasks), revision: recovered.meeting.draft_revision || 0, saved: false, retained: true });
        setDraftPayload({ ...blank, meeting_name: recovered.meeting.title, meeting_date: recovered.meeting.meeting_date, has_source_notes: true });
      } else {
        setDraft({ ...data, structured: withIds(data.structured), revision: 0 });
        setDraftPayload({ ...blank, meeting_name: data.meeting.title, meeting_date: data.meeting.meeting_date, has_source_notes: true });
      }
      setDirty(true); setIsExample(false); setView("new"); setTab("actions"); setActiveJob(null); setUndo(null); setComposer(false); setShareChannel(null);
    } catch (err) { if (identityRef.current === owner) setError(err.name === "AbortError" ? "Paused. Resume when you are ready." : err.message); }
    finally { setBusy(""); if (identityRef.current === owner) { refreshJobs(); refreshAccount(); refreshHistory(); } }
  }
  async function discardJob() {
    if (busy || !window.confirm("Discard this unfinished transcript and its processed sections?")) return;
    setBusy("discard");
    try { await api("/api/meetings/jobs/" + activeJob.id, null, "DELETE"); setActiveJob(null); setJobProgress(null); generationKey.current = null; notify("Unfinished upload discarded."); refreshAccount(); }
    catch (err) { setError(err.message); } finally { setBusy(""); }
  }

  function editOutput(change) {
    if (busy) return;
    setUndo(clone(draft.structured));
    setDraft((previous) => ({ ...previous, structured: change(previous.structured) }));
    setDirty(true); setComposer(false); setShareChannel(null); saveKey.current = null; setNotice("");
  }
  function editTask(id, key, value) {
    editOutput((output) => ({ ...output, action_items: output.action_items.map((task) => task.id === id ? { ...task, [key]: value } : task) }));
  }
  function undoEdit() {
    if (!undo || busy) return;
    setDraft((previous) => ({ ...previous, structured: undo }));
    setUndo(null); setDirty(true); saveKey.current = null; setComposer(false); setShareChannel(null);
  }

  async function refineDraft(event) {
    event.preventDefault();
    if (!refine.trim() || busy) return;
    if (isExample) { notify("Example mode: edit the table directly. Sign in to refine your own meeting."); return; }
    const owner = identityRef.current;
    setBusy("refine"); setError("");
    try {
      const request = { instruction: refine, structured: stripIds(draft.structured), payload: draftPayload, meeting_id: draft.meeting.id };
      const fingerprint = JSON.stringify(request);
      if (refinementKey.current?.fingerprint !== fingerprint) refinementKey.current = { fingerprint, id: crypto.randomUUID() };
      abortRef.current = new AbortController();
      const data = await runTranscriptJob({ payload: draftPayload, requestId: refinementKey.current.id, refinement: { instruction: refine, structured: stripIds(draft.structured), meeting_id: draft.meeting.id }, request: jobRequest, signal: abortRef.current.signal,
        onProgress: (progress) => { if (identityRef.current === owner) { setActiveJob(progress); setJobProgress(progress); setStage(progress.stage); } } });
      if (identityRef.current !== owner) return;
      setUndo(clone(draft.structured));
      setDraft((previous) => ({ ...previous, ...data, structured: withIds(data.structured, previous.structured.action_items) }));
      setDraftPayload((previous) => ({ ...previous, has_source_notes: true }));
      setRefine(""); setDirty(true); setComposer(false); setShareChannel(null); setActiveJob(null); saveKey.current = null;
      notify("Changes applied. Review before sharing.");
    } catch (err) { setError(err.message); }
    finally { setBusy(""); if (identityRef.current === owner) refreshJobs(); }
  }

  async function saveDraft() {
    const owner = identityRef.current;
    if (isExample) throw new Error("This is an example. Create your own meeting to save it.");
    if (!dirty && draft.saved) return draft;
    const id = saveKey.current || crypto.randomUUID();
    saveKey.current = id;
    const saved = await api("/api/meetings/save", {
      meeting: draft.meeting, structured: stripIds(draft.structured), action_ids: draft.structured.action_items.map((task) => task.id),
      revision: draft.revision || 0, save_id: id
    });
    if (identityRef.current !== owner) throw new Error("Your session changed. Sign in again to continue.");
    const next = { ...draft, saved: true, meeting: saved.meeting, revision: saved.meeting.draft_revision, structured: { ...draft.structured, action_items: draft.structured.action_items.map((task) => ({ ...task, update_token: saved.action_items.find((row) => row.id === task.id)?.update_token })) } };
    setDraft(next); setDirty(false);
    return next;
  }
  async function save() {
    if (busy) return;
    setBusy("save"); setError("");
    try { await saveDraft(); notify("Review saved. Your commitments are ready to share."); await refreshHistory(); await refreshAccount(); }
    catch (err) { setError(err.message); }
    finally { setBusy(""); }
  }

  const reportText = () => buildPostMeetingEmail({ meeting: { ...draft.meeting, summary: draft.structured.summary }, structured: draft.structured, tasks: draft.structured.action_items, prepQuestions: draft.structured.prep_questions });

  async function copy(kind) {
    try {
      const text = kind === "email" ? reportText() : buildMeetingWhatsApp({ meeting: draft.meeting, tasks: draft.structured.action_items, structured: draft.structured });
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
    generationKey.current = null; refinementKey.current = null;
    setDraft(createExampleReview());
    setDraftPayload({ ...blank, ...exampleInput });
    setIsExample(true); setDirty(false); setInputTouched(false); setError(""); setNotice("");
    setView("new"); setTab("actions"); setUndo(null); setComposer(false); setShareChannel(null); setRefine(""); saveKey.current = null;
  }
  function newMeeting() {
    if (busy) return;
    if (dirty && !isExample && !window.confirm("Leave this unsaved draft?")) return;
    generationKey.current = null; refinementKey.current = null;
    setDraft(null); setForm({ ...blank, meeting_date: dateToday() }); setIsExample(false); setView("new"); setDirty(false); setError(""); setNotice(""); setShareChannel(null);
  }
  async function openMeeting(selectedMeeting) {
    if (busy) return;
    if (dirty && !window.confirm("Leave this unsaved draft?")) return;
    const owner = identityRef.current;
    setBusy("open"); setError("");
    try {
    const data = await api("/api/dashboard/tasks?meeting_id=" + encodeURIComponent(selectedMeeting.id));
    if (identityRef.current !== owner) return;
    const meeting = data.meeting;
    const rows = data.tasks;
    const snapshot = meeting.output_snapshot || { summary: meeting.summary || "", language: meeting.language || "unknown", readiness_score: meeting.readiness_score || 0, action_items: [], prep_questions: [], decisions: [], blockers: [] };
    const reviewed = meeting.status === "reviewed";
    const actionItems = reviewed ? rows.map((task) => ({ task: task.task, owner: task.owner || "Unassigned", team: task.team || "", due_date: task.due_date || "", status: task.status, priority: task.priority, evidence: task.evidence || "", id: task.id, update_token: task.update_token, last_nudged_at: task.last_nudged_at })) : withIds(snapshot).action_items;
    setDraft({ meeting, structured: { ...snapshot, action_items: actionItems }, saved: reviewed, retained: true, revision: meeting.draft_revision || 0, warnings: [] });
    setDraftPayload({ ...blank, meeting_name: meeting.title, meeting_date: meeting.meeting_date, raw_notes: meeting.source_notes || "", has_source_notes: meeting.has_source_notes });
    setView("new"); setTab("actions"); setIsExample(false); setDirty(!reviewed); setUndo(null); setComposer(false); setError(""); setNotice(""); saveKey.current = null;
    } catch (err) { setError(err.message); }
    finally { setBusy(""); }
  }

  async function importTranscript(event) {
    const file = event.target.files?.[0]; event.target.value = "";
    if (!file) return;
    if (!/\.(txt|md|vtt|srt)$/i.test(file.name) || file.size > MAX_TRANSCRIPT_BYTES) { setError("Choose a TXT, Markdown, VTT or SRT transcript up to 8 MiB. There is no line-count limit."); return; }
    try {
      const text = await file.text();
      if (text.includes("\u0000") || text.includes("\uFFFD")) throw new Error("This file is not readable UTF-8 text. Export it as UTF-8 TXT or VTT and import again.");
      update("raw_notes", text); update("source", "transcript_import"); setError("");
    } catch (err) { setError(err.message || "The file could not be read. Your existing notes are unchanged."); }
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
  const currentActionPage = Math.min(actionPage, Math.max(0, Math.ceil(tasks.length / REVIEW_PAGE_SIZE) - 1));
  const currentPrepPage = Math.min(prepPage, Math.max(0, Math.ceil((output?.prep_questions.length || 0) / REVIEW_PAGE_SIZE) - 1));
  const missing = tasks.filter((task) => !task.owner || task.owner === "Unassigned" || !task.due_date).length;
  const readiness = tasks.length ? Math.round(tasks.reduce((sum, task) => sum + (task.owner && task.owner !== "Unassigned" ? 1 : 0) + (task.due_date ? 1 : 0), 0) / (tasks.length * 2) * 100) : 0;
  const blocked = historyTasks.filter((task) => task.status === "blocked").length;
  const open = historyTasks.filter((task) => task.status !== "done").length;
  const completed = historyTasks.filter((task) => task.status === "done").length;
  const plan = account?.plan || PLANS.free;
  const capacityFull = account && account.usage.retained >= plan.retained;
  const inputIssue = inputTouched ? assessNotes(form.raw_notes) : "";
  const wordCount = useMemo(() => (form.raw_notes.match(/[\p{L}\p{N}][\p{L}\p{M}\p{N}'-]*/gu) || []).length, [form.raw_notes]);
  const whatsappText = output ? buildMeetingWhatsApp({ meeting: draft.meeting, tasks, structured: output }) : "";
  const whatsappLink = composeLink("whatsapp", { text: whatsappText });

  return <div className="kaarya-app">
    <Head><title>Kaarya | Meeting minutes & clear next steps</title><meta name="description" content="Turn meeting notes into clear minutes, decisions and action items. Review, share and keep the next steps moving." /></Head>
    <header className="app-header">
      <button className="brand" onClick={() => setView("new")} aria-label="Kaarya workspace"><span className="brand-mark"><ClipboardCheck size={21} /></span>Kaarya{user && <span className="workspace-label">Workspace</span>}</button>
      <nav className="top-tabs" aria-label="Workspace"><button aria-current={view === "new" ? "page" : undefined} onClick={() => setView("new")}><FileText size={16} /><span>Meeting</span></button><button aria-current={view === "history" ? "page" : undefined} onClick={() => { setView("history"); if (user) refreshHistory(); }}><History size={16} /><span>{user ? "History" : "My meetings"}</span></button><button aria-current={view === "pricing" ? "page" : undefined} onClick={() => setView("pricing")}>Plans</button></nav>
      {user ? <div className="account"><button className="profile-trigger" aria-label="Open profile and usage" aria-current={view === "account" ? "page" : undefined} onClick={() => { setView("account"); refreshAccount(); }}><span className="avatar-initial" aria-hidden="true">{(account?.profile?.full_name || user.user_metadata?.full_name || "K").slice(0, 1)}</span><span>{account?.profile?.full_name?.split(" ")[0] || user.user_metadata?.full_name?.split(" ")[0] || "Account"}</span></button><ToolButton label="Sign out" disabled={Boolean(busy) || recording} onClick={() => { if (!dirty || window.confirm("Sign out and leave this unsaved draft?")) getAuthClient().then((auth) => auth?.auth.signOut()); }}><LogOut size={17} /></ToolButton></div> : <button className="button sign-in" onClick={login} disabled={!authReady}><LogIn size={16} /><span>Sign in with Google</span></button>}
    </header>
    <main className="workspace">
      {(error || notice) && <div className={"feedback " + (error ? "error" : "success")} role={error ? "alert" : "status"}><span>{error || notice}</span><ToolButton label="Dismiss message" onClick={() => { setError(""); setNotice(""); }}><X size={16} /></ToolButton></div>}
      {activeJob && !busy && <div className="resume-banner" role="status"><div><strong>{activeJob.title || "Your transcript"} is waiting</strong><span>{activeJob.status === "uploading" ? activeJob.uploaded.length + " of " + activeJob.upload_count + " upload parts saved" : activeJob.completed_sections + " of " + activeJob.total_sections + " sections saved"} · Available until {new Date(activeJob.expires_at).toLocaleString()}</span></div><button className="button primary" onClick={resumeJob}>Resume<ArrowRight size={16} /></button><ToolButton label="Discard unfinished transcript" onClick={discardJob}><Trash2 size={16} /></ToolButton></div>}
      {!user && !draft && view === "new" && <section className="welcome-heading"><p className="eyebrow">A little clarity. A lot of progress.</p><h1>Meeting minutes.{" "}<br /><span>Clear next steps.</span></h1><p>Don't let your meeting become a memory.</p></section>}
      {view === "pricing" ? <PricingContent onBack={() => setView("new")} /> : view === "account" && user ? <AccountPanel account={account} onSave={saveProfile} onPricing={() => setView("pricing")} busy={Boolean(busy)} /> : view === "history" ? <section>
        <div className="section-heading"><div><p className="eyebrow">Your workspace</p><h1>Meeting history</h1></div><button className="button primary" onClick={newMeeting}><Plus size={17} />New meeting</button></div>
        {!user ? <div className="empty-state"><ShieldCheck size={30} /><h2>Your meetings, in one place.</h2><div className="button-row"><button className="button primary" onClick={login}><LogIn size={16} />Sign in with Google</button><button className="button" onClick={loadExample}><Sparkles size={16} />Try an example</button></div></div> : <>
          <div className="history-stats"><div><strong>{account?.usage.retained ?? meetings.length}</strong><span>Retained meetings</span></div><div><strong>{open}</strong><span>Recent open actions</span></div><div><strong>{completed}</strong><span>Recent completions</span></div><ToolButton label="Refresh history" onClick={() => { refreshHistory(); refreshAccount(); }} disabled={historyBusy}><RefreshCw size={18} className={historyBusy ? "spin" : ""} /></ToolButton></div>
          {capacityFull && <div className="quota-banner"><span>{plan.retained} of {plan.retained} meetings retained. Export and delete a meeting to make room.</span><button className="button subtle" onClick={() => setView("pricing")}>View plans<ArrowRight size={15} /></button></div>}
          {historyBusy && !meetings.length ? <p role="status">Loading your meetings...</p> : !meetings.length ? <div className="empty-state"><History size={28} /><h2>No saved meetings yet.</h2><button className="button" onClick={newMeeting}>New meeting<ArrowRight size={16} /></button></div> : <div className="meeting-list" aria-busy={Boolean(busy)}>{busy === "open" && <p role="status">Opening meeting...</p>}{meetings.map((meeting) => <div className="history-entry" key={meeting.id}><button className="meeting-row" disabled={Boolean(busy)} onClick={() => openMeeting(meeting)}><FileText size={21} /><span><strong>{meeting.title}</strong><small>{meeting.meeting_date} · {meeting.status === "reviewed" ? "Reviewed" : meeting.status === "draft" ? "Awaiting review" : "Saved meeting"}</small></span><ArrowRight size={17} /></button><div className="history-actions"><ToolButton label={"Export " + meeting.title} disabled={Boolean(busy)} onClick={() => exportMeeting(meeting)}><Download size={16} /></ToolButton><ToolButton label={"Delete " + meeting.title} disabled={Boolean(busy)} onClick={() => setDeleteTarget(meeting)}><Trash2 size={16} /></ToolButton></div></div>)}</div>}
          {nextOffset !== null && <button className="button load-more" disabled={historyBusy} onClick={() => refreshHistory(nextOffset)}>Load more meetings<ChevronDown size={16} /></button>}
        </>}
      </section> : !draft ? <section className={"intake-layout " + (user ? "signed-in-intake" : "public-intake")}>
        <div className="intake-main">
          <div className="section-heading intake-title"><div>{user && <p className="eyebrow">{"Welcome back, " + (account?.profile?.full_name?.split(" ")[0] || user.user_metadata?.full_name?.split(" ")[0] || "you")}</p>}{user ? <h1>What's on the table today?</h1> : <h2>Your meeting notes</h2>}</div><button className="button subtle" onClick={loadExample} disabled={Boolean(busy) || recording}><Sparkles size={16} />Try an example</button></div>
          {account && <div className="workspace-pulse"><button onClick={() => setView("history")}><strong>{open}</strong><span>Open actions</span></button><button onClick={() => setView("history")}><strong>{blocked}</strong><span>Blocked</span></button><button onClick={() => setView("history")} className="completion-count"><CheckCircle2 size={17} /><strong>{completed}</strong><span>Completed</span></button><span className="pulse-caption">Recent actions</span></div>}
          {account && <div className="allowance-strip"><span>{plan.name} · {Math.max(0, plan.meetings - account.usage.generated)} meeting{plan.meetings - account.usage.generated === 1 ? "" : "s"} left this {plan.period} · {account.usage.retained}/{plan.retained} retained</span><button onClick={() => setView("account")}>Usage<ArrowRight size={13} /></button></div>}
          {capacityFull && <div className="quota-banner"><span>Your meeting history is full.</span><button className="button subtle" onClick={() => setView("history")}>Manage history<ArrowRight size={15} /></button></div>}
          <form onSubmit={generate}>
            <div className="notes-heading"><label htmlFor="meeting-notes">{user ? "Meeting notes" : "Notes or transcript"}</label><span className={"badge " + (isExample ? "amber" : "")}>{isExample ? "Example" : "Not shared"}</span></div>
            <textarea id="meeting-notes" className="notes-input" placeholder="Paste your meeting notes or transcript here. Rough notes, a full conversation, or a few decisions - start with what you have." value={form.raw_notes} onChange={(event) => update("raw_notes", event.target.value)} onBlur={() => setInputTouched(true)} disabled={Boolean(busy)} aria-invalid={Boolean(inputIssue)} aria-describedby={inputIssue ? "input-error" : undefined} />
            {inputIssue && <p id="input-error" className="field-error">{inputIssue}</p>}
            <div className="capture-toolbar"><div><button type="button" className="button subtle" onClick={() => fileRef.current.click()} disabled={Boolean(busy) || recording}><FileText size={16} />Import transcript</button><button type="button" className="icon-button" title="Record a voice note" aria-label="Record a voice note" onClick={() => setShowRecording(!showRecording)} disabled={Boolean(busy)}><Mic size={17} /></button><input hidden type="file" ref={fileRef} accept=".txt,.md,.vtt,.srt" onChange={importTranscript} /></div><span className="character-count">{wordCount.toLocaleString()} words{form.raw_notes.length > DIRECT_TRANSCRIPT_LENGTH ? " · Long transcript" : ""}</span></div>
            {showRecording && <div className="record-controls"><label className="consent"><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} />I have consent to record this 30-second voice note.</label><button type="button" className={"button " + (recording ? "recording" : "")} onClick={record} disabled={Boolean(busy)}>{recording ? <Square size={15} /> : <Mic size={16} />}{recording ? "Stop " + recordSeconds + "s" : "Record"}</button></div>}
            <details className="context-fields"><summary>Meeting details <span>Optional</span><ChevronDown size={16} /></summary><div className="field-grid"><Field label="Meeting name"><input maxLength={180} value={form.meeting_name} onChange={(event) => update("meeting_name", event.target.value)} placeholder="Client launch review" /></Field><Field label="Meeting date"><input type="date" value={form.meeting_date} onChange={(event) => update("meeting_date", event.target.value)} required /></Field><Field label="People involved"><input maxLength={1200} value={form.attendees} onChange={(event) => update("attendees", event.target.value)} placeholder="Asha, Rohan, Priya" /></Field><Field label="Meeting outcome"><input maxLength={2000} value={form.agenda} onChange={(event) => update("agenda", event.target.value)} placeholder="Approve the pilot launch" /></Field></div></details>

            {busy ? <div className="processing" role="status" aria-live="polite"><Loader2 size={20} className="spin" /><div><strong>{busy === "transcribe" ? "Transcribing your voice note" : stages[stage] || "Working"}</strong><span>{jobProgress?.total_sections ? jobProgress.completed_sections + " of " + jobProgress.total_sections + " sections saved · " : jobProgress?.stage === "uploading" ? jobProgress.completed + " of " + jobProgress.total + " parts uploaded · " : ""}{elapsed}s elapsed</span>{jobProgress?.total_sections > 0 && <progress max={jobProgress.total_sections} value={jobProgress.completed_sections} aria-label="Transcript sections completed" />}</div>{busy === "generate" && <ToolButton label="Pause processing" onClick={() => abortRef.current?.abort()}><Square size={16} /></ToolButton>}</div> : <button className="button primary generate" type="submit" disabled={recording || Boolean(activeJob)}><Sparkles size={18} />Create minutes & action items<ArrowRight size={18} /></button>}
            {!user && <div className="intake-trust"><ShieldCheck size={14} /><span>Private workspace. Review before sharing.</span><a href="/security">Data & privacy</a></div>}
          </form>
        </div>
        <IntakePreview onExample={loadExample} />
      </section> : <motion.section ref={resultRef} initial={reduced ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22 }}>
        <div className="section-heading review-heading"><div><p className="eyebrow">02 / Review {isExample && "· Example"}</p><h1>{draft.meeting.title}</h1><span className="review-meta">{draft.meeting.meeting_date} · {isExample ? "Example, not saved" : draft.retained && !draft.saved ? "Private draft, awaiting review" : dirty ? "Unsaved changes" : "Review saved"}{draft.processing ? " · AI processing " + (draft.processing.duration_ms / 1000).toFixed(1) + "s" : ""}</span></div><div className="button-row"><ToolButton label="Undo last edit" disabled={!undo || Boolean(busy)} onClick={undoEdit}><Undo2 size={17} /></ToolButton><button className="button" onClick={newMeeting} disabled={Boolean(busy)}><Plus size={16} />New meeting</button><button className="button primary" onClick={save} disabled={Boolean(busy) || isExample || (!dirty && draft.saved)}>{busy === "save" ? <Loader2 size={16} className="spin" /> : <Save size={16} />}{draft.saved && !dirty ? "Saved" : "Save review"}</button></div></div>
        <div className="review-stats"><span><strong>{tasks.length}</strong> actions</span><span className={missing ? "attention" : "positive"}>{missing ? missing + " need an owner or date" : "Owners and dates complete"}</span><span title="Share of action owner and due-date fields completed. Not a meeting productivity or accuracy score.">Action completeness <strong>{readiness}%</strong></span></div>
        {draft.warnings?.length > 0 && <div className="review-warning" role="status">{draft.warnings.join(" ")}</div>}
        <div className="output-tabs" role="tablist" aria-label="Meeting output">{[["actions", "Action items", tasks.length], ["decisions", "Meeting minutes", output.minutes?.length || 0], ["prep", "Next meeting", output.prep_questions.length]].map(([value, label, count]) => <button key={value} id={"tab-" + value} role="tab" aria-selected={tab === value} aria-controls="output-panel" tabIndex={tab === value ? 0 : -1} onKeyDown={(event) => { const order = ["actions", "decisions", "prep"]; const index = order.indexOf(tab); const target = event.key === "ArrowRight" ? order[(index + 1) % 3] : event.key === "ArrowLeft" ? order[(index + 2) % 3] : event.key === "Home" ? order[0] : event.key === "End" ? order[2] : null; if (target) { event.preventDefault(); setTab(target); document.getElementById("tab-" + target)?.focus(); } }} onClick={() => setTab(value)}>{label}<span>{count}</span></button>)}</div>
        <div role="tabpanel" id="output-panel" aria-labelledby={"tab-" + tab}>
        {tab === "actions" ? <>
          {tasks.length ? <div className="action-table"><table><thead><tr><th>Action / evidence</th><th>Owner / team</th><th>Due</th><th>Status / priority</th><th><span className="sr-only">Tools</span></th></tr></thead><tbody>{tasks.slice(currentActionPage * REVIEW_PAGE_SIZE, (currentActionPage + 1) * REVIEW_PAGE_SIZE).map((task, pageIndex) => { const index = pageIndex + currentActionPage * REVIEW_PAGE_SIZE; return <tr key={task.id}><td><GrowingTextarea aria-label={"Action " + (index + 1)} value={task.task} maxLength={260} rows={2} onChange={(event) => editTask(task.id, "task", event.target.value)} disabled={Boolean(busy)} /><details className="evidence"><summary>Source quote</summary><p>{task.evidence || "Added during review."}</p></details></td><td><input aria-label={"Owner " + (index + 1)} className={!task.owner || task.owner === "Unassigned" ? "missing" : ""} maxLength={120} value={task.owner} onChange={(event) => editTask(task.id, "owner", event.target.value)} placeholder="Unassigned" disabled={Boolean(busy)} /><input aria-label={"Team " + (index + 1)} maxLength={120} value={task.team} onChange={(event) => editTask(task.id, "team", event.target.value)} placeholder="Team" disabled={Boolean(busy)} /></td><td><input aria-label={"Due date " + (index + 1)} type="date" className={!task.due_date ? "missing" : ""} value={task.due_date} onChange={(event) => editTask(task.id, "due_date", event.target.value)} disabled={Boolean(busy)} /></td><td><select aria-label={"Status " + (index + 1)} value={task.status} onChange={(event) => editTask(task.id, "status", event.target.value)} disabled={Boolean(busy)}>{[["pending", "Pending"], ["in_progress", "In progress"], ["blocked", "Blocked"], ["done", "Done"]].map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><select aria-label={"Priority " + (index + 1)} value={task.priority} onChange={(event) => editTask(task.id, "priority", event.target.value)} disabled={Boolean(busy)}>{["Low", "Medium", "High"].map((priority) => <option key={priority}>{priority}</option>)}</select></td><td><ToolButton label={"Remove action " + (index + 1)} onClick={() => editOutput((current) => ({ ...current, action_items: current.action_items.filter((item) => item.id !== task.id) }))} disabled={Boolean(busy)}><Trash2 size={16} /></ToolButton>{task.update_token && !dirty && <a className="task-link" href={"/task/" + task.update_token} target="_blank" rel="noreferrer">Update link</a>}<small className="last-nudge">{task.last_nudged_at ? "Last nudge: " + new Date(task.last_nudged_at).toLocaleDateString() : "No nudge sent"}</small></td></tr>; })}</tbody></table></div> : <div className="empty-state"><CheckCircle2 size={28} /><h2>No agreed actions found.</h2><p>Review the decisions or add a confirmed next step.</p></div>}
          <PageControls count={tasks.length} page={currentActionPage} onChange={setActionPage} label="actions" busy={Boolean(busy)} />
          <button className="button subtle add-action" disabled={Boolean(busy) || tasks.length >= 2000} onClick={() => { setActionPage(Math.floor(tasks.length / REVIEW_PAGE_SIZE)); editOutput((current) => ({ ...current, action_items: [...current.action_items, { id: crypto.randomUUID(), task: "", owner: "Unassigned", team: "", due_date: "", status: "pending", priority: "Medium", evidence: "" }] })); }}><Plus size={16} />Add action</button>
        </> : tab === "decisions" ? <MeetingMinutes output={output} onEdit={editOutput} busy={Boolean(busy)} Textarea={GrowingTextarea} /> : <div className="prep-panel">{output.prep_questions.length ? output.prep_questions.slice(currentPrepPage * REVIEW_PAGE_SIZE, (currentPrepPage + 1) * REVIEW_PAGE_SIZE).map((question, pageIndex) => { const index = pageIndex + currentPrepPage * REVIEW_PAGE_SIZE; return <div className="prep-row" key={index}><span className="question-number">{String(index + 1).padStart(2, "0")}</span><div><input aria-label={"Question owner " + (index + 1)} value={question.intended_owner} maxLength={120} disabled={Boolean(busy)} onChange={(event) => editOutput((current) => ({ ...current, prep_questions: current.prep_questions.map((item, i) => i === index ? { ...item, intended_owner: event.target.value } : item) }))} /><GrowingTextarea aria-label={"Prep question " + (index + 1)} value={question.question} rows={2} maxLength={260} disabled={Boolean(busy)} onChange={(event) => editOutput((current) => ({ ...current, prep_questions: current.prep_questions.map((item, i) => i === index ? { ...item, question: event.target.value } : item) }))} /><p>{question.reason}</p></div><ToolButton label={"Remove question " + (index + 1)} disabled={Boolean(busy)} onClick={() => editOutput((current) => ({ ...current, prep_questions: current.prep_questions.filter((_, i) => i !== index) }))}><X size={17} /></ToolButton></div>; }) : <div className="empty-state"><CheckCircle2 size={26} /><h2>No unresolved questions captured.</h2></div>}</div>}
        {tab === "prep" && <PageControls count={output.prep_questions.length} page={currentPrepPage} onChange={setPrepPage} label="questions" busy={Boolean(busy)} />}
        </div>
        <form className="refine-form" onSubmit={refineDraft}><MessageSquare size={20} /><input aria-label="Refine this draft" placeholder="What needs changing? e.g. Priya owns vendor approval, due Monday." value={refine} onChange={(event) => setRefine(event.target.value)} maxLength={2000} disabled={Boolean(busy) || !(draftPayload?.raw_notes || draftPayload?.has_source_notes)} /><button className="button" aria-label="Refine draft" title="Refine draft" disabled={Boolean(busy) || !refine.trim()}>{busy === "refine" ? <Loader2 size={16} className="spin" /> : <ArrowRight size={16} />}<span>Refine</span></button></form>
        {busy === "refine" && jobProgress?.total_sections > 0 && <p className="section-description" role="status">Refining section {Math.min(jobProgress.completed_sections + 1, jobProgress.total_sections)} of {jobProgress.total_sections}. Completed sections are saved.</p>}
        <section className="share-section"><div className="section-heading"><div><p className="eyebrow">The next step is yours.</p><h2>Make it happen.</h2></div><span className="badge">Nothing sent automatically</span></div><div className="share-controls">{whatsappLink.needsPaste ? <button className="button primary" onClick={() => setShareChannel("whatsapp")}><MessageSquare size={16} />Prepare WhatsApp<ArrowRight size={15} /></button> : <a className="button primary" href={whatsappLink.href} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer"><MessageSquare size={16} />Open WhatsApp<ArrowRight size={15} /></a>}<button className="button" onClick={() => setShareChannel("email")}><Mail size={16} />Open email</button><button className="button" onClick={() => copy("email")}><Copy size={16} />Copy minutes</button><ToolButton label="Download action items as CSV" onClick={downloadCsv}><Download size={18} /></ToolButton>{integrations.email && <button className="button subtle" disabled={Boolean(busy) || isExample} onClick={() => { setEmailText(reportText()); setComposer(true); setSendLater(false); }}><Send size={16} />Send through Kaarya</button>}</div>
          {shareChannel && <ShareDraft key={shareChannel} channel={shareChannel} report={reportText()} whatsapp={buildMeetingWhatsApp({ meeting: draft.meeting, tasks, structured: output })} title={draft.meeting.title} onClose={() => setShareChannel(null)} />}

        </section>
        <AnimatePresence>{composer && <motion.form className="email-composer" onSubmit={send} initial={reduced ? false : { opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}><div className="section-heading"><h2>Email draft</h2><ToolButton label="Close email draft" onClick={() => setComposer(false)} disabled={Boolean(busy)}><X size={18} /></ToolButton></div><Field label="To"><input type="email" multiple required value={recipient} onChange={(event) => setRecipient(event.target.value)} disabled={Boolean(busy)} /></Field><Field label="Message"><textarea rows={12} value={emailText} onChange={(event) => setEmailText(event.target.value)} maxLength={30000} disabled={Boolean(busy)} /></Field><div className="email-footer"><label className="consent"><input type="checkbox" checked={sendLater} onChange={(event) => setSendLater(event.target.checked)} disabled={Boolean(busy)} />Send later</label>{sendLater && <Field label="Delivery time (your local time)"><input type="datetime-local" required value={schedule} onChange={(event) => setSchedule(event.target.value)} disabled={Boolean(busy)} /></Field>}<button type="submit" className="button primary" disabled={Boolean(busy)}>{busy === "send" ? <Loader2 size={16} className="spin" /> : <Send size={16} />}{sendLater ? "Schedule email" : "Send approved email"}</button></div></motion.form>}</AnimatePresence>
      </motion.section>}
    </main>
    {deleteTarget && <dialog className="delete-dialog" ref={deleteDialog} onCancel={(event) => { if (busy) event.preventDefault(); else setDeleteTarget(null); }} onClose={() => setDeleteTarget(null)} aria-labelledby="delete-title"><h2 id="delete-title">Delete this meeting?</h2><p><strong>{deleteTarget.title}</strong></p><p>Its notes, actions and saved drafts will be removed from Kaarya. Task links will stop working. Previously sent emails and external copies will not be recalled. Backups follow the hosting provider's retention policy.</p><p>Today's used meeting allowance will not be restored.</p><div className="button-row"><button className="button" autoFocus disabled={Boolean(busy)} onClick={() => setDeleteTarget(null)}>Keep meeting</button><button className="button danger" disabled={Boolean(busy)} onClick={deleteMeeting}>{busy === "delete" ? <Loader2 size={16} className="spin" /> : <Trash2 size={16} />}Delete meeting</button></div></dialog>}
    <footer className="app-footer"><span>Kaarya</span><a href="/security">Privacy & data</a><span>Conversations into accountability.</span></footer>
  </div>;
}
