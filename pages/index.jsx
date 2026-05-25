import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  BarChart3,
  CalendarPlus,
  CheckCircle2,
  ClipboardCheck,
  Cloud,
  Database,
  FileText,
  Gauge,
  Loader2,
  Mail,
  MessageSquare,
  Mic,
  Network,
  Play,
  Send,
  ShieldCheck,
  Sparkles,
  Square,
  Table2,
  Users
} from "lucide-react";

const ease = [0.16, 1, 0.3, 1];

const pipeline = [
  { key: "input", label: "Input", detail: "Form, Tally, mic, transcript", icon: Mic },
  { key: "make", label: "Make", detail: "Validation and routing", icon: Network },
  { key: "storage", label: "Storage", detail: "Supabase records and files", icon: Database },
  { key: "ai", label: "AI", detail: "Sarvam plus structured extraction", icon: Sparkles },
  { key: "tasks", label: "Tasks", detail: "Owners, teams, due dates", icon: ClipboardCheck },
  { key: "followup", label: "Follow-up", detail: "Email, dashboard, Teams, Slack", icon: Send }
];

const defaultForm = {
  source: "website",
  meeting_name: "",
  meeting_date: "",
  attendees: "",
  agenda: "",
  raw_notes: "",
  email: "",
  language_hint: "",
  audio_url: "",
  attachment_url: "",
  destination_channels: ["email", "dashboard", "notion", "teams", "slack"]
};

function Logo() {
  return (
    <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white text-black shadow-[0_0_30px_rgba(255,255,255,0.16)]">
      <ClipboardCheck size={19} strokeWidth={2.4} />
    </div>
  );
}

function StatusDot({ active }) {
  return (
    <span className={`h-2 w-2 rounded-full ${active ? "bg-emerald-400 shadow-[0_0_14px_rgba(52,211,153,0.8)]" : "bg-zinc-600"}`} />
  );
}

function Field({ label, children }) {
  return (
    <label className="block space-y-2">
      <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">{label}</span>
      {children}
    </label>
  );
}

const inputClass = "w-full rounded-lg border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none transition focus:border-white/30 focus:bg-black/70";

function FlowMap({ activeIndex }) {
  return (
    <div className="grid gap-3 md:grid-cols-6">
      {pipeline.map((step, index) => {
        const Icon = step.icon;
        const active = index <= activeIndex;
        return (
          <motion.div
            key={step.key}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.06, duration: 0.5, ease }}
            className={`relative min-h-[132px] rounded-lg border p-4 transition ${
              active ? "border-white/20 bg-white/[0.075]" : "border-white/10 bg-white/[0.025]"
            }`}
          >
            <div className="mb-4 flex items-center justify-between">
              <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${active ? "bg-white text-black" : "bg-white/5 text-zinc-500"}`}>
                <Icon size={17} />
              </div>
              <StatusDot active={active} />
            </div>
            <div className="text-sm font-semibold text-white">{step.label}</div>
            <div className="mt-1 text-xs leading-5 text-zinc-500">{step.detail}</div>
            {active && (
              <motion.div
                layoutId="flow-glow"
                className="absolute inset-x-4 bottom-0 h-px bg-gradient-to-r from-transparent via-white/70 to-transparent"
              />
            )}
          </motion.div>
        );
      })}
    </div>
  );
}

function TaskTable({ tasks }) {
  return (
    <div className="overflow-hidden rounded-lg border border-white/10">
      <div className="grid grid-cols-[1.5fr_0.8fr_0.7fr_0.7fr_0.6fr] gap-3 border-b border-white/10 bg-white/[0.04] px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
        <span>Action</span>
        <span>Owner</span>
        <span>Team</span>
        <span>Due</span>
        <span>Status</span>
      </div>
      {tasks.map((task) => (
        <motion.div
          key={task.id}
          layout
          className="grid grid-cols-[1.5fr_0.8fr_0.7fr_0.7fr_0.6fr] gap-3 border-b border-white/5 px-4 py-4 text-sm last:border-b-0"
        >
          <span className="text-zinc-200">{task.task}</span>
          <span className="text-zinc-400">{task.owner || "Unassigned"}</span>
          <span className="text-zinc-400">{task.team || "-"}</span>
          <span className="text-zinc-400">{task.due_date || "-"}</span>
          <span className={`capitalize ${task.status === "blocked" ? "text-rose-300" : task.status === "done" ? "text-emerald-300" : "text-amber-200"}`}>
            {String(task.status || "pending").replace("_", " ")}
          </span>
        </motion.div>
      ))}
    </div>
  );
}

function InsightCard({ icon: Icon, label, value, sub }) {
  return (
    <motion.div whileHover={{ y: -3 }} className="rounded-lg border border-white/10 bg-white/[0.045] p-5">
      <div className="mb-5 flex items-center justify-between">
        <Icon size={18} className="text-zinc-400" />
        <div className="h-1.5 w-1.5 rounded-full bg-white/40" />
      </div>
      <div className="text-2xl font-semibold tracking-tight text-white">{value}</div>
      <div className="mt-1 text-xs uppercase tracking-[0.16em] text-zinc-500">{label}</div>
      <div className="mt-3 text-xs leading-5 text-zinc-400">{sub}</div>
    </motion.div>
  );
}

function ChannelToggle({ channel, active, onClick }) {
  const labels = {
    email: "Email",
    dashboard: "Dashboard",
    notion: "Notion",
    teams: "Teams",
    slack: "Slack"
  };
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg border px-3 py-2 text-xs font-medium transition ${
        active ? "border-white/25 bg-white text-black" : "border-white/10 bg-white/[0.035] text-zinc-400 hover:text-white"
      }`}
    >
      {labels[channel]}
    </button>
  );
}

function fileToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result || "").split(",")[1] || "");
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export default function KaaryaV1() {
  const [form, setForm] = useState(defaultForm);
  const [activeFlow, setActiveFlow] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submission, setSubmission] = useState(null);
  const [meetings, setMeetings] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [prepQuestions, setPrepQuestions] = useState([]);
  const [integrations, setIntegrations] = useState({});
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [audioStatus, setAudioStatus] = useState("");
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);

  useEffect(() => {
    setForm((prev) => ({ ...prev, meeting_date: new Date().toISOString().split("T")[0] }));
    refreshDashboard();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => setActiveFlow((current) => (current + 1) % pipeline.length), 1800);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (isRecording) {
      timerRef.current = setInterval(() => setRecordingSeconds((value) => value + 1), 1000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [isRecording]);

  const openTasks = useMemo(() => tasks.filter((task) => task.status !== "done"), [tasks]);
  const readiness = useMemo(() => {
    if (submission?.structured?.readiness_score) return submission.structured.readiness_score;
    if (!tasks.length) return 72;
    const blocked = tasks.filter((task) => task.status === "blocked").length;
    return Math.max(35, Math.round(90 - blocked * 14 - openTasks.length * 3));
  }, [openTasks.length, submission, tasks]);

  async function refreshDashboard() {
    const [meetingResponse, taskResponse] = await Promise.all([
      fetch("/api/dashboard/meetings"),
      fetch("/api/dashboard/tasks")
    ]);
    const meetingData = await meetingResponse.json();
    const taskData = await taskResponse.json();
    setMeetings(meetingData.meetings || []);
    setTasks(taskData.tasks || []);
    setPrepQuestions(taskData.prep_questions || []);
    setIntegrations(meetingData.integrations || {});
  }

  function update(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function toggleChannel(channel) {
    setForm((prev) => {
      const has = prev.destination_channels.includes(channel);
      return {
        ...prev,
        destination_channels: has
          ? prev.destination_channels.filter((item) => item !== channel)
          : [...prev.destination_channels, channel]
      };
    });
  }

  async function toggleRecording() {
    if (isRecording) {
      recorderRef.current?.stop();
      setIsRecording(false);
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setAudioStatus("Microphone recording is not supported in this browser.");
      return;
    }

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const recorder = new MediaRecorder(stream);
    chunksRef.current = [];
    recorderRef.current = recorder;
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunksRef.current.push(event.data);
    };
    recorder.onstop = async () => {
      setAudioStatus("Uploading audio...");
      const blob = new Blob(chunksRef.current, { type: "audio/webm" });
      const base64 = await fileToBase64(blob);
      const response = await fetch("/api/audio/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: `kaarya-meeting-${Date.now()}.webm`,
          mimeType: "audio/webm",
          base64
        })
      });
      const data = await response.json();
      if (response.ok) {
        update("audio_url", data.url);
        setAudioStatus("Audio attached to this meeting.");
      } else {
        setAudioStatus(data.error || "Audio upload failed.");
      }
      stream.getTracks().forEach((track) => track.stop());
    };
    setRecordingSeconds(0);
    setAudioStatus("Recording...");
    recorder.start();
    setIsRecording(true);
  }

  async function submitMeeting(event) {
    event.preventDefault();
    setIsSubmitting(true);
    setSubmission(null);

    const stages = [0, 1, 2, 3, 4, 5];
    stages.forEach((stage, index) => {
      setTimeout(() => setActiveFlow(stage), index * 360);
    });

    try {
      const response = await fetch("/api/meetings/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      });
      const data = await response.json();
      setSubmission({ ok: response.ok, ...data });
      if (data.structured?.action_items?.length) {
        setTasks(data.structured.action_items.map((item, index) => ({ ...item, id: `new-${index}` })));
        setPrepQuestions(data.structured.prep_questions.map((item, index) => ({ ...item, id: `prep-new-${index}` })));
      }
      await refreshDashboard();
    } catch (error) {
      setSubmission({ ok: false, error: error.message });
    } finally {
      setIsSubmitting(false);
    }
  }

  const recordingLabel = `${Math.floor(recordingSeconds / 60).toString().padStart(2, "0")}:${(recordingSeconds % 60).toString().padStart(2, "0")}`;

  return (
    <div className="min-h-screen bg-[#050505] text-[#ededed] selection:bg-white/20">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        body { font-family: Inter, system-ui, sans-serif; background: #050505; }
        .grid-bg {
          background-image:
            linear-gradient(rgba(255,255,255,0.045) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.045) 1px, transparent 1px);
          background-size: 42px 42px;
        }
      `}</style>

      <nav className="fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-black/50 px-5 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between">
          <div className="flex items-center gap-3">
            <Logo />
            <div>
              <div className="text-sm font-semibold text-white">Kaarya</div>
              <div className="text-[11px] text-zinc-500">Conversations into accountability</div>
            </div>
          </div>
          <div className="hidden items-center gap-2 md:flex">
            {["make", "supabase", "sarvam", "notion"].map((key) => (
              <div key={key} className="flex items-center gap-2 rounded-full border border-white/10 px-3 py-1.5 text-[11px] uppercase tracking-[0.14em] text-zinc-400">
                <StatusDot active={integrations[key]} />
                {key}
              </div>
            ))}
          </div>
        </div>
      </nav>

      <main className="grid-bg relative overflow-hidden pt-24">
        <section className="mx-auto max-w-7xl px-5 pb-14 pt-10">
          <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-end">
            <div>
              <motion.div
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, ease }}
                className="mb-7 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.045] px-3 py-1.5 text-xs text-zinc-400"
              >
                <Sparkles size={14} className="text-white" />
                Meeting intelligence for prepared teams
              </motion.div>
              <motion.h1
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.75, delay: 0.06, ease }}
                className="max-w-3xl text-5xl font-semibold tracking-tight text-white md:text-7xl"
              >
                No meeting should end as memory.
              </motion.h1>
              <motion.p
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.75, delay: 0.12, ease }}
                className="mt-6 max-w-2xl text-lg leading-8 text-zinc-400"
              >
                Kaarya captures messy notes, transcripts, and voice input, then converts them into owners, due dates, prep questions, and periodic follow-ups.
              </motion.p>
            </div>

            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8, delay: 0.18, ease }}
              className="rounded-lg border border-white/10 bg-black/50 p-5 shadow-2xl backdrop-blur-xl"
            >
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold text-white">Live accountability flow</div>
                  <div className="text-xs text-zinc-500">Website and Tally route into the same backend intelligence.</div>
                </div>
                <Play size={18} className="text-zinc-400" />
              </div>
              <FlowMap activeIndex={activeFlow} />
            </motion.div>
          </div>
        </section>

        <section className="mx-auto grid max-w-7xl gap-5 px-5 pb-8 md:grid-cols-4">
          <InsightCard icon={Gauge} label="Readiness" value={`${readiness}%`} sub="Based on unresolved owners, blockers, and next-meeting prep risk." />
          <InsightCard icon={Table2} label="Open Tasks" value={openTasks.length} sub="Action items remain visible until owners update progress." />
          <InsightCard icon={MessageSquare} label="Follow-up" value="2 days" sub="Scheduled reminders keep accountability warm without WhatsApp cost." />
          <InsightCard icon={ShieldCheck} label="Channels" value="5" sub="Dashboard, email, Notion, Teams, and Slack are available in v1." />
        </section>

        <section className="mx-auto grid max-w-7xl gap-5 px-5 pb-20 lg:grid-cols-[0.9fr_1.1fr]">
          <motion.form
            onSubmit={submitMeeting}
            layout
            className="rounded-lg border border-white/10 bg-black/60 p-5 shadow-2xl backdrop-blur-xl md:p-7"
          >
            <div className="mb-7 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-semibold tracking-tight text-white">Submit meeting signal</h2>
                <p className="mt-2 text-sm leading-6 text-zinc-400">Paste notes, record voice, or route Tally into Make. Kaarya turns the input into a task-ready operating layer.</p>
              </div>
              <Cloud className="mt-1 text-zinc-500" size={22} />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Meeting name">
                <input className={inputClass} value={form.meeting_name} onChange={(e) => update("meeting_name", e.target.value)} placeholder="Q3 roadmap sync" />
              </Field>
              <Field label="Meeting date">
                <input className={inputClass} type="date" value={form.meeting_date} onChange={(e) => update("meeting_date", e.target.value)} />
              </Field>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <Field label="Owner email">
                <input className={inputClass} type="email" value={form.email} onChange={(e) => update("email", e.target.value)} placeholder="naveen@company.com" />
              </Field>
              <Field label="Language hint">
                <input className={inputClass} value={form.language_hint} onChange={(e) => update("language_hint", e.target.value)} placeholder="auto, hi-IN, ta-IN, te-IN" />
              </Field>
            </div>

            <div className="mt-4">
              <Field label="Accountable people or teams">
                <input className={inputClass} value={form.attendees} onChange={(e) => update("attendees", e.target.value)} placeholder="Ravi - Growth, Meera - CS, Ops Team" />
              </Field>
            </div>

            <div className="mt-4">
              <Field label="Agenda">
                <input className={inputClass} value={form.agenda} onChange={(e) => update("agenda", e.target.value)} placeholder="Renewals, rollout blockers, next meeting prep" />
              </Field>
            </div>

            <div className="mt-4">
              <Field label="Transcript or rough notes">
                <textarea
                  className={`${inputClass} min-h-[150px] resize-none leading-6`}
                  value={form.raw_notes}
                  onChange={(e) => update("raw_notes", e.target.value)}
                  placeholder="Paste meeting notes, chat dumps, or transcript here. Short, messy input is fine."
                />
              </Field>
            </div>

            <div className="mt-5 rounded-lg border border-white/10 bg-white/[0.035] p-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="text-sm font-semibold text-white">Microphone capture</div>
                  <div className="mt-1 text-xs text-zinc-500">{audioStatus || "Record a voice note and attach it to the pipeline."}</div>
                </div>
                <button
                  type="button"
                  onClick={toggleRecording}
                  className={`flex items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold transition ${
                    isRecording ? "bg-rose-500/20 text-rose-200" : "bg-white text-black hover:bg-zinc-200"
                  }`}
                >
                  {isRecording ? <Square size={16} /> : <Mic size={16} />}
                  {isRecording ? recordingLabel : "Record"}
                </button>
              </div>
            </div>

            <div className="mt-5">
              <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">Delivery channels</div>
              <div className="flex flex-wrap gap-2">
                {["email", "dashboard", "notion", "teams", "slack"].map((channel) => (
                  <ChannelToggle
                    key={channel}
                    channel={channel}
                    active={form.destination_channels.includes(channel)}
                    onClick={() => toggleChannel(channel)}
                  />
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="mt-7 flex w-full items-center justify-center gap-2 rounded-lg bg-white px-5 py-3.5 text-sm font-semibold text-black transition hover:bg-zinc-200 disabled:opacity-60"
            >
              {isSubmitting ? <Loader2 size={17} className="animate-spin" /> : <ArrowRight size={17} />}
              {isSubmitting ? "Running accountability pipeline" : "Create action system"}
            </button>

            <AnimatePresence>
              {submission && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className={`mt-5 rounded-lg border p-4 text-sm ${
                    submission.ok ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-100" : "border-rose-400/25 bg-rose-400/10 text-rose-100"
                  }`}
                >
                  {submission.ok ? "Pipeline accepted. Tasks, prep questions, and delivery routes are ready." : submission.error || "Submission failed."}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.form>

          <div className="space-y-5">
            <section className="rounded-lg border border-white/10 bg-black/60 p-5 backdrop-blur-xl md:p-7">
              <div className="mb-5 flex items-start justify-between">
                <div>
                  <h2 className="text-2xl font-semibold tracking-tight text-white">Dashboard source of truth</h2>
                  <p className="mt-2 text-sm text-zinc-400">Supabase-backed records appear here; demo data is shown until credentials are configured.</p>
                </div>
                <BarChart3 className="text-zinc-500" size={22} />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {meetings.slice(0, 4).map((meeting) => (
                  <motion.div key={meeting.id} whileHover={{ y: -2 }} className="rounded-lg border border-white/10 bg-white/[0.035] p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-semibold text-white">{meeting.title}</div>
                      <span className="rounded-full bg-white/10 px-2 py-1 text-[11px] text-zinc-400">{meeting.status}</span>
                    </div>
                    <div className="mt-3 text-xs leading-5 text-zinc-500">{meeting.summary || "Waiting for processing summary."}</div>
                    <div className="mt-4 flex items-center justify-between text-xs text-zinc-400">
                      <span>{meeting.meeting_date || "-"}</span>
                      <span>{meeting.readiness_score || readiness}/100 ready</span>
                    </div>
                  </motion.div>
                ))}
              </div>
            </section>

            <section className="rounded-lg border border-white/10 bg-black/60 p-5 backdrop-blur-xl md:p-7">
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold tracking-tight text-white">Action items</h2>
                  <p className="mt-2 text-sm text-zinc-400">Less prose, more ownership. This is the format copied to email and synced to Notion.</p>
                </div>
                <FileText className="text-zinc-500" size={21} />
              </div>
              <TaskTable tasks={tasks.slice(0, 6)} />
            </section>

            <section className="grid gap-5 md:grid-cols-2">
              <div className="rounded-lg border border-white/10 bg-black/60 p-5 backdrop-blur-xl">
                <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-white">
                  <CalendarPlus size={17} />
                  Next meeting prep
                </div>
                <div className="space-y-3">
                  {prepQuestions.slice(0, 3).map((item) => (
                    <div key={item.id} className="rounded-lg bg-white/[0.035] p-3 text-sm leading-6 text-zinc-300">
                      {item.question}
                      <div className="mt-2 text-xs text-zinc-500">{item.intended_owner || item.intended_team || "Team"} should answer this before the next call.</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-lg border border-white/10 bg-black/60 p-5 backdrop-blur-xl">
                <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-white">
                  <Users size={17} />
                  Follow-up loop
                </div>
                <div className="space-y-3 text-sm text-zinc-400">
                  <div className="flex items-center justify-between rounded-lg bg-white/[0.035] p-3">
                    <span>Email report</span>
                    <CheckCircle2 size={16} className="text-emerald-300" />
                  </div>
                  <div className="flex items-center justify-between rounded-lg bg-white/[0.035] p-3">
                    <span>Teams and Slack updates</span>
                    <CheckCircle2 size={16} className="text-emerald-300" />
                  </div>
                  <div className="flex items-center justify-between rounded-lg bg-white/[0.035] p-3">
                    <span>Two-day pending task scan</span>
                    <CheckCircle2 size={16} className="text-emerald-300" />
                  </div>
                </div>
              </div>
            </section>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/10 bg-black px-5 py-10">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 text-sm text-zinc-500 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <Logo />
            <span>Kaarya by Static Technologies Private Limited</span>
          </div>
          <div className="flex items-center gap-2">
            <Mail size={15} />
            Clean, copy-pasteable outputs for Word, mail, Notion, Teams, and Slack.
          </div>
        </div>
      </footer>
    </div>
  );
}
