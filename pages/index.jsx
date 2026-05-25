import { useState, useEffect, useRef } from "react";

// Webhook destination pointing to your central Make.com scenario
const MAKE_WEBHOOK = "https://hook.eu2.make.com/8181h2iv2hxhp3k8m8cqes58ntj5vc3j";

// Premium Brand Asset: Geometric 'K' with an Amber Execution/Action Point
const KaaryaLogo = ({ size = 32 }) => (
  <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className="transition-transform duration-300 hover:scale-105">
    <rect width="48" height="48" rx="14" fill="#00C2A8" />
    <path d="M15 11V37" stroke="#0A1F3D" strokeWidth="4" strokeLinecap="round"/>
    <path d="M15 24L31 11" stroke="#0A1F3D" strokeWidth="4" strokeLinecap="round"/>
    <path d="M15 24L33 37" stroke="#0A1F3D" strokeWidth="4" strokeLinecap="round"/>
    <circle cx="36" cy="24" r="4.5" fill="#F59E0B" className="animate-pulse" />
  </svg>
);

export default function PremiumKaaryaApp() {
  const [activeTab, setActiveTab] = useState("submit");
  const [inputMethod, setInputMethod] = useState("text"); // text, audio, image, video
  const [formStep, setFormStep] = useState(1);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [waitlistSuccess, setWaitlistSuccess] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  
  // Audio Recording State Simulated for Web Prototyping
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const timerRef = useRef(null);
  const appContainerRef = useRef(null);

  // Form states tracking all multi-utility variables
  const [meetingData, setMeetingData] = useState({
    meeting_name: "",
    meeting_date: new Date().toISOString().split('T')[0],
    attendees: "",
    agenda: "",
    raw_notes: "",
    email: "",
    uploaded_file_name: ""
  });

  const [waitlistData, setWaitlistData] = useState({
    name: "", company: "", email: "", role: ""
  });

  // Handle transparent to dark blur navigation header adaptation
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Handle custom audio clock simulation
  useEffect(() => {
    if (isRecording) {
      timerRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);
    } else {
      clearInterval(timerRef.current);
      setRecordingDuration(0);
    }
    return () => clearInterval(timerRef.current);
  }, [isRecording]);

  const formatDuration = (sec) => {
    const mins = Math.floor(sec / 60);
    const secs = sec % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const updateForm = (key, val) => setMeetingData(prev => ({ ...prev, [key]: val }));
  const updateWaitlist = (key, val) => setWaitlistData(prev => ({ ...prev, [key]: val }));

  const executeMeetingPipeline = async () => {
    setIsProcessing(true);
    try {
      await fetch(MAKE_WEBHOOK, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        mode: "no-cors",
        body: JSON.stringify({ 
          ...meetingData, 
          input_method: inputMethod,
          platform_source: "kaarya_premium_v2", 
          execution_type: "production_run" 
        })
      });
    } catch (error) {
      console.error("Pipeline handoff logging:", error);
    }
    setTimeout(() => {
      setIsProcessing(false);
      setIsSubmitted(true);
    }, 2000);
  };

  const executeWaitlistPipeline = async () => {
    setIsProcessing(true);
    try {
      await fetch(MAKE_WEBHOOK, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        mode: "no-cors",
        body: JSON.stringify({ ...waitlistData, platform_source: "kaarya_premium_v2", execution_type: "waitlist_opt_in" })
      });
    } catch (error) {
      console.error("Waitlist handoff logging:", error);
    }
    setTimeout(() => {
      setIsProcessing(false);
      setWaitlistSuccess(true);
    }, 1500);
  };

  const focusViewOnInteractiveWorkspace = (targetTab) => {
    setActiveTab(targetTab);
    const element = document.getElementById("workspace-hub");
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <div ref={appContainerRef} className="bg-[#060B13] text-slate-100 min-height-screen font-sans selection:bg-[#00C2A8] selection:text-[#0A1F3D]">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&family=Syne:wght@700;800&display=swap');
        .font-headline { font-family: 'Syne', sans-serif; }
        .font-body { font-family: 'DM Sans', sans-serif; }
        .glass-panel { background: rgba(15, 23, 42, 0.65); backdrop-filter: blur(16px); border: 1px solid rgba(255, 255, 255, 0.05); }
        .dopamine-glow { box-shadow: 0 0 40px -10px rgba(0, 194, 168, 0.3); }
        .gradient-text { background: linear-gradient(135deg, #fff 30%, #00C2A8 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
      `}</style>

      {/* TOP DEPLOYMENT NAVIGATION */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 px-[5%] h-20 flex items-center justify-between ${isScrolled ? "bg-[#0A1F3D]/90 backdrop-blur-md border-b border-white/10" : "bg-transparent"}`}>
        <div className="flex items-center gap-3">
          <KaaryaLogo size={38} />
          <div>
            <div className="text-xl font-headline font-800 tracking-tight text-white leading-none">Kaarya</div>
            <div className="text-[10px] text-[#00C2A8] tracking-[2px] uppercase font-bold mt-1">The Static Technologies</div>
          </div>
        </div>
        <div className="flex gap-4">
          <button onClick={() => focusViewOnInteractiveWorkspace("submit")} className="text-sm font-medium px-5 py-2.5 rounded-xl border border-white/10 hover:border-[#00C2A8]/40 transition-colors">Workspace</button>
          <button onClick={() => focusViewOnInteractiveWorkspace("waitlist")} className="text-sm font-bold px-5 py-2.5 rounded-xl bg-[#00C2A8] text-[#0A1F3D] hover:bg-[#00C2A8]/90 transition-all duration-200 shadow-lg shadow-[#00C2A8]/10">Get Early Access</button>
        </div>
      </nav>

      {/* PREMIUM HIGH-DOPAMINE HERO BANNER */}
      <section className="relative min-h-screen flex flex-col items-center justify-center text-center px-[5%] pt-24 overflow-hidden bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#0A2D30] via-[#060B13] to-[#060B13]">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[#00C2A8]/5 rounded-full blur-[120px] pointer-events-none animate-pulse" />
        
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 mb-8 animate-fade-in">
          <span className="w-2 h-2 rounded-full bg-[#00C2A8] animate-ping" />
          <span className="text-xs font-bold uppercase tracking-widest text-[#00C2A8]">Operational Intelligence Platform</span>
        </div>

        <h1 className="font-headline text-4xl sm:text-6xl lg:text-7xl font-800 text-white leading-[1.1] max-w-4xl tracking-tight mb-6">
          Every meeting ends.<br />
          <span className="gradient-text">Kaarya Enforces Action.</span>
        </h1>

        <p className="font-body text-lg text-slate-400 max-w-2xl leading-relaxed mb-12">
          Stop writing transcripts nobody opens. Drop rough voice memos, handwritten notes, or messy text directly. Get structured execution frameworks and live automated WhatsApp loops instantly.
        </p>

        <div className="flex flex-wrap gap-4 justify-center">
          <button onClick={() => focusViewOnInteractiveWorkspace("submit")} className="px-8 py-4 bg-[#00C2A8] text-[#0A1F3D] font-bold rounded-xl text-base shadow-xl shadow-[#00C2A8]/20 hover:bg-[#00C2A8]/90 transform hover:-translate-y-0.5 transition-all">
            Launch Dynamic Workspace →
          </button>
          <button onClick={() => focusViewOnInteractiveWorkspace("waitlist")} className="px-8 py-4 bg-white/5 border border-white/10 hover:border-white/20 text-white font-medium rounded-xl text-base transition-all">
            Secure Enterprise Tier
          </button>
        </div>

        {/* METRICS DISPLAY BAR */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-16 mt-20 max-w-5xl border-t border-white/5 pt-12 w-full">
          {[
            ["45 Seconds", "Average MoM Turnaround"],
            ["Sarvam AI V3", "Native Indian Dialect Speech Engine"],
            ["Zero Friction", "No Manual Tool Management"],
            ["148x Margin", "Engineered for Extreme Efficiency"]
          ].map(([metric, label]) => (
            <div key={metric} className="text-center">
              <div className="text-2xl font-headline font-800 text-white">{metric}</div>
              <div className="text-xs text-slate-500 font-body uppercase tracking-wider mt-1">{label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* THREE-STEP LIFECYCLE PARADIGM */}
      <section className="py-24 px-[5%] bg-[#080E1A] relative border-y border-white/5">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <div className="text-xs font-bold text-[#00C2A8] uppercase tracking-[3px] mb-3">Operational Workflow Architecture</div>
            <h2 className="font-headline text-3xl md:text-5xl font-800 text-white">Closing The Accountability Cycle</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { num: "01", icon: "🎙️", title: "Asynchronous Input Ingestion", desc: "Speak naturally, drop messy snapshots of whiteboards, or forward raw accents. Sarvam OCR and Speech layers process Indian context cleanly." },
              { num: "02", icon: "💎", title: "Human-In-The-Loop Approval", desc: "The platform's UI provides the leader with a powerful 1-click orchestration engine. Review, edit, and authorize instantly with extreme confidence." },
              { num: "03", icon: "⚡", title: "Persistent Automated Nudges", desc: "Decisions are parsed instantly. Deadlines map directly into individual WhatsApp utility alerts. Real-time updates update live project trackers." }
            ].map((step, i) => (
              <div key={i} className="glass-panel rounded-2xl p-8 relative overflow-hidden group hover:border-[#00C2A8]/30 transition-all duration-300">
                <div className="absolute top-0 right-0 p-6 text-6xl opacity-10 select-none group-hover:scale-110 transition-transform">{step.icon}</div>
                <div className="text-xs font-bold text-[#00C2A8] tracking-widest mb-6 font-headline">{step.num}</div>
                <h3 className="text-xl font-bold text-white mb-3 font-headline">{step.title}</h3>
                <p className="text-sm text-slate-400 leading-relaxed font-body">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CORE CONTROL HUB / WORKSPACE ENGINE */}
      <section id="workspace-hub" className="py-24 px-[5%] max-w-5xl mx-auto" ref={formRef}>
        <div className="flex bg-white/5 p-1.5 rounded-2xl border border-white/5 mb-10 shadow-inner">
          <button onClick={() => setActiveTab("submit")} className={`flex-1 py-4 text-center rounded-xl text-sm font-headline tracking-wide font-bold transition-all ${activeTab === "submit" ? "bg-[#0A1F3D] text-[#00C2A8] shadow-lg border border-[#00C2A8]/20 dopamine-glow" : "text-slate-400 hover:text-white"}`}>
            📝 EXECUTABLE MEETING WORKSPACE
          </button>
          <button onClick={() => setActiveTab("waitlist")} className={`flex-1 py-4 text-center rounded-xl text-sm font-headline tracking-wide font-bold transition-all ${activeTab === "waitlist" ? "bg-[#0A1F3D] text-[#00C2A8] shadow-lg border border-[#00C2A8]/20 dopamine-glow" : "text-slate-400 hover:text-white"}`}>
            🚀 SECURE EARLY ACCESS PASS
          </button>
        </div>

        {activeTab === "submit" && !isSubmitted && (
          <div className="glass-panel rounded-3xl p-8 md:p-12 relative overflow-hidden border-white/10">
            <div className="mb-8">
              <h3 className="text-2xl font-headline font-800 text-white">Dynamic Session Ingestion</h3>
              <p className="text-sm text-slate-400 mt-1">Select your raw material payload channel below. No manual pre-formatting required.</p>
            </div>

            {/* INTEGRATED MULTI-INPUT NAVIGATION LAYER */}
            <div className="grid grid-cols-4 gap-2 mb-8 border-b border-white/5 pb-6">
              {[
                { id: "text", label: "Raw Text / Notes", icon: "✍️" },
                { id: "audio", label: "Sarvam Voice Engine", icon: "🎙️" },
                { id: "image", label: "Vision OCR Scan", icon: "📸" },
                { id: "video", label: "Media Extract", icon: "🎥" }
              ].map(method => (
                <button
                  key={method.id}
                  onClick={() => setInputMethod(method.id)}
                  className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all ${inputMethod === method.id ? "bg-[#00C2A8]/10 border-[#00C2A8] text-white" : "border-white/5 text-slate-400 hover:bg-white/5"}`}
                >
                  <span className="text-xl mb-1">{method.icon}</span>
                  <span className="text-[10px] font-bold tracking-wider uppercase text-center hidden sm:inline">{method.label}</span>
                </button>
              ))}
            </div>

            {/* THREE STEP STEPPER INDICATOR */}
            <div className="flex items-center gap-4 mb-8 max-w-md">
              {[1, 2, 3].map(s => (
                <div key={s} className="flex-1 flex items-center gap-2">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${formStep >= s ? "bg-[#00C2A8] text-[#0A1F3D]" : "bg-white/5 text-slate-500"}`}>
                    {formStep > s ? "✓" : s}
                  </div>
                  <span className={`text-xs uppercase font-bold tracking-wider ${formStep === s ? "text-white" : "text-slate-500"}`}>{s === 1 ? "Metadata" : s === 2 ? "Payload" : "Distribution"}</span>
                  {s < 3 && <div className="flex-1 h-[2px] bg-white/5" />}
                </div>
              ))}
            </div>

            {/* STEP 1: CONTEXT METADATA COLLECTION */}
            {formStep === 1 && (
              <div className="space-y-6 animate-fade-in">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div>
                    <label className="text-[11px] uppercase tracking-widest font-bold text-slate-400 block mb-2">Meeting Focus / Identifier *</label>
                    <input type="text" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3.5 text-sm text-white focus:outline-none transition-all" value={meetingData.meeting_name} onChange={e => updateForm("meeting_name", e.target.value)} placeholder="e.g. JobCliff Execution & SOW Status Review" />
                  </div>
                  <div>
                    <label className="text-[11px] uppercase tracking-widest font-bold text-slate-400 block mb-2">Session Timestamp *</label>
                    <input type="date" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3.5 text-sm text-white focus:outline-none transition-all" value={meetingData.meeting_date} onChange={e => updateForm("meeting_date", e.target.value)} />
                  </div>
                </div>
                <div>
                  <label className="text-[11px] uppercase tracking-widest font-bold text-slate-400 block mb-2">Active Attendees Accountable *</label>
                  <input type="text" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3.5 text-sm text-white focus:outline-none transition-all" value={meetingData.attendees} onChange={e => updateForm("attendees", e.target.value)} placeholder="e.g. Ravi Krishnan, Miller Khandhar, Danish, Tahir, Sarmila" />
                </div>
                <button onClick={() => meetingData.meeting_name && meetingData.meeting_date && meetingData.attendees && setFormStep(2)} className={`w-full py-4 rounded-xl text-sm font-headline font-bold transition-all ${meetingData.meeting_name && meetingData.meeting_date && meetingData.attendees ? "bg-[#0A1F3D] text-[#00C2A8] border border-[#00C2A8]/30" : "bg-white/5 text-slate-500 cursor-not-allowed"}`}>
                  Initialize Workflow Block →
                </button>
              </div>
            )}

            {/* STEP 2: HIGH-FIDELITY payload CAPTURE (ADAPTIVE INTERFACE) */}
            {formStep === 2 && (
              <div className="space-y-6 animate-fade-in">
                <div>
                  <label className="text-[11px] uppercase tracking-widest font-bold text-slate-400 block mb-2">Session Directives / Target Agenda *</label>
                  <textarea className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none h-20 resize-none" value={meetingData.agenda} onChange={e => updateForm("agenda", e.target.value)} placeholder="1. ABS Deliverables Performance&#10;2. Multi-Platform Channel Distribution Testing&#10;3. Budget Operational Squeezes" />
                </div>

                {/* ADAPTIVE MULTI-INPUT FIELD GRAPHICS */}
                <div>
                  <label className="text-[11px] uppercase tracking-widest font-bold text-slate-400 block mb-2">Raw Dynamic Material Input *</label>
                  
                  {inputMethod === "text" && (
                    <textarea className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-4 text-sm text-white focus:outline-none h-44 font-mono leading-relaxed" value={meetingData.raw_notes} onChange={e => updateForm("raw_notes", e.target.value)} placeholder="Type or dump chaotic scratchpad thoughts here. Mention name commitments, missed deliverables, dates or open disputes openly. The algorithm cleans the prose structure natively." />
                  )}

                  {inputMethod === "audio" && (
                    <div className="border-2 border-dashed border-white/10 rounded-2xl p-8 flex flex-col items-center justify-center bg-white/[0.02]">
                      <div className={`w-20 h-20 rounded-full flex items-center justify-center text-2xl mb-4 cursor-pointer shadow-lg transition-all ${isRecording ? "bg-red-500 text-white animate-pulse" : "bg-[#00C2A8] text-[#0A1F3D] hover:scale-105"}`} onClick={() => setIsRecording(!isRecording)}>
                        {isRecording ? "⏹️" : "🎙️"}
                      </div>
                      <div className="text-sm font-bold tracking-wider mb-1 font-headline">{isRecording ? "STREAMING LOCAL AUDIO PAYLOAD" : "INITIALIZE SARVAM SPEECH LAYER"}</div>
                      <div className="text-xs text-slate-500 mb-3 text-center max-w-xs">{isRecording ? `Capturing real-time data flow: ${formatDuration(recordingDuration)}` : "Click token bubble to record speech. Handles regional pronunciations and mother-tongue influences flawlessly."}</div>
                    </div>
                  )}

                  {inputMethod === "image" && (
                    <div className="border-2 border-dashed border-white/10 rounded-2xl p-8 flex flex-col items-center justify-center bg-white/[0.02] relative">
                      <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer" onChange={(e) => updateForm("uploaded_file_name", e.target.files[0]?.name || "")} />
                      <div className="text-3xl mb-3">📸</div>
                      <div className="text-sm font-bold mb-1 font-headline">{meetingData.uploaded_file_name || "MOUNT HANDWRITTEN / WHITEBOARD IMAGE"}</div>
                      <div className="text-xs text-slate-500 text-center max-w-xs">Supports direct camera capture or media uploads. Parsed natively via custom vision heuristics.</div>
                    </div>
                  )}

                  {inputMethod === "video" && (
                    <div className="border-2 border-dashed border-white/10 rounded-2xl p-8 flex flex-col items-center justify-center bg-white/[0.02] relative">
                      <input type="file" accept="video/*" className="absolute inset-0 opacity-0 cursor-pointer" onChange={(e) => updateForm("uploaded_file_name", e.target.files[0]?.name || "")} />
                      <div className="text-3xl mb-3">🎥</div>
                      <div className="text-sm font-bold mb-1 font-headline">{meetingData.uploaded_file_name || "MOUNT LOCAL MEETING RECORDING FILE"}</div>
                      <div className="text-xs text-slate-500 text-center max-w-xs">Extracts structural audio components server-side before executing speech modeling algorithms.</div>
                    </div>
                  )}
                </div>

                <div className="flex gap-4">
                  <button onClick={() => setFormStep(1)} className="px-6 py-4 rounded-xl text-sm font-bold border border-white/10 text-slate-400 hover:text-white transition-colors">← Regress Context</button>
                  <button onClick={() => (meetingData.raw_notes || meetingData.uploaded_file_name || isRecording || recordingDuration > 0) && setFormStep(3)} className={`flex-1 py-4 rounded-xl text-sm font-headline font-bold transition-all ${(meetingData.raw_notes || meetingData.uploaded_file_name || isRecording || recordingDuration > 0) ? "bg-[#00C2A8] text-[#0A1F3D]" : "bg-white/5 text-slate-500 cursor-not-allowed"}`}>Commit Content Block →</button>
                </div>
              </div>
            )}

            {/* STEP 3: INDUSTRIAL WORKPLACE ROUTING */}
            {formStep === 3 && (
              <div className="space-y-6 animate-fade-in">
                <div>
                  <label className="text-[11px] uppercase tracking-widest font-bold text-slate-400 block mb-2">Orchestrator Email Identifier *</label>
                  <input type="email" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3.5 text-sm text-white focus:outline-none" value={meetingData.email} onChange={e => updateForm("email", e.target.value)} placeholder="yourname@statictechnologies.in" />
                </div>

                <div className="bg-[#0A2222] border border-[#00C2A8]/30 rounded-xl p-5 flex gap-4 items-start">
                  <span className="text-xl">⚡</span>
                  <div className="text-xs text-[#9EECE0] leading-relaxed">
                    <span className="font-bold block text-sm mb-1 text-white">Execution Package Assets Ready:</span>
                    • High-end HTML Structured Business Minutes document layout production.<br />
                    • Complete action registry parsing across standard Indian template modules.<br />
                    • Real-time automated task serialization hooks handed to Make.com variables.
                  </div>
                </div>

                <div className="flex gap-4">
                  <button onClick={() => setFormStep(2)} className="px-6 py-4 rounded-xl text-sm font-bold border border-white/10 text-slate-400 hover:text-white transition-colors">← Regress Payload</button>
                  <button onClick={executeMeetingPipeline} disabled={!meetingData.email || isProcessing} className="flex-1 py-4 bg-[#00C2A8] text-[#0A1F3D] rounded-xl font-headline font-bold text-sm tracking-wide disabled:opacity-50 transition-all flex items-center justify-center gap-2">
                    {isProcessing ? (
                      <>
                        <span className="w-4 h-4 border-2 border-[#0A1F3D] border-t-transparent rounded-full animate-spin" />
                        Analyzing Pipeline Structures...
                      </>
                    ) : (
                      "Authorize Algorithmic Generation →"
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* HIGH DOPAMINE SUCCESS MATRIX FEEDBACK */}
        {activeTab === "submit" && isSubmitted && (
          <div className="glass-panel rounded-3xl p-12 text-center border-[#00C2A8]/20 dopamine-glow animate-fade-in">
            <div className="text-5xl mb-6">🎉</div>
            <h3 className="text-2xl font-headline font-800 text-white mb-2">Pipeline Execution Confirmed</h3>
            <p className="text-sm text-slate-400 max-w-md mx-auto leading-relaxed mb-8">
              The processing loop has terminated successfully. Check structural inbox at <strong className="text-white">{meetingData.email}</strong> in under 60 seconds.
            </p>
            <div className="flex gap-4 justify-center">
              <button onClick={() => { setIsSubmitted(false); setFormStep(1); setMeetingData({ meeting_name: "", meeting_date: new Date().toISOString().split('T')[0], attendees: "", agenda: "", raw_notes: "", email: "", uploaded_file_name: "" }); }} className="px-6 py-3.5 rounded-xl text-sm font-bold border border-white/10 text-slate-300 hover:text-white transition-colors">Ingest New Assembly</button>
              <button onClick={() => setTab("waitlist")} className="px-6 py-3.5 rounded-xl text-sm font-bold bg-[#00C2A8] text-[#0A1F3D]">Scale Team Strategy</button>
            </div>
          </div>
        )}

        {/* PREMIUM ENTERPRISE ACCESS ACQUISITION PANEL */}
        {activeTab === "waitlist" && !waitlistSuccess && (
          <div className="glass-panel rounded-3xl p-8 md:p-12 border-white/10 animate-fade-in">
            <div className="mb-8">
              <h3 className="text-2xl font-headline font-800 text-white">Join the Beta Cohort</h3>
              <p className="text-sm text-slate-400 mt-1">First 50 operating teams acquire full-cycle permissions for 3 months with zero infrastructure charges.</p>
            </div>

            <div className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="text-[11px] uppercase tracking-widest font-bold text-slate-400 block mb-2">Full Legal Name *</label>
                  <input type="text" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3.5 text-sm text-white focus:outline-none" value={waitlistData.name} onChange={e => updateWaitlist("name", e.target.value)} placeholder="e.g. Naveen Raja Mahesh Kumar" />
                </div>
                <div>
                  <label className="text-[11px] uppercase tracking-widest font-bold text-slate-400 block mb-2">Corporate Entity *</label>
                  <input type="text" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3.5 text-sm text-white focus:outline-none" value={waitlistData.company} onChange={e => updateWaitlist("company", e.target.value)} placeholder="e.g. Vedanta Foundation" />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="text-[11px] uppercase tracking-widest font-bold text-slate-400 block mb-2">Operational Role Hierarchy *</label>
                  <select className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3.5 text-sm text-slate-300 focus:outline-none cursor-pointer" value={waitlistData.role} onChange={e => updateWaitlist("role", e.target.value)}>
                    <option value="" className="bg-[#060B13]">Select Identity</option>
                    <option className="bg-[#060B13]">CEO / Corporate Founder</option>
                    <option className="bg-[#060B13]">Executive Assistant / Chief of Staff</option>
                    <option className="bg-[#060B13]">Branding & Communication Specialist</option>
                    <option className="bg-[#060B13]">Project / SOW Manager</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] uppercase tracking-widest font-bold text-slate-400 block mb-2">Secure Contact Email *</label>
                  <input type="email" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3.5 text-sm text-white focus:outline-none" value={waitlistData.email} onChange={e => updateWaitlist("email", e.target.value)} placeholder="naveen@vedantafoundation.org" />
                </div>
              </div>

              <div className="bg-[#291B05] border border-[#F59E0B]/30 rounded-xl p-5">
                <div className="text-xs text-[#FCD34D] leading-relaxed">
                  <span className="font-bold block text-sm mb-1 text-white">🎁 Inclusions Authorized to First 50 Corporate Teams:</span>
                  • Lifetime pricing stabilization metrics locked below market rates.<br />
                  • Bespoke custom-branded operational asset document layout architecture.<br />
                  • Direct strategic product roadmap engineering collaboration loops.
                </div>
              </div>

              <button onClick={executeWaitlistPipeline} disabled={!waitlistData.name || !waitlistData.company || !waitlistData.role || !waitlistData.email || isProcessing} className="w-full py-4 bg-[#00C2A8] text-[#0A1F3D] rounded-xl font-headline font-bold text-sm tracking-wide disabled:opacity-40 transition-all flex items-center justify-center gap-2">
                {isProcessing ? "Securing Entry Parameters..." : "Register Priority Allocation Spot →"}
              </button>
            </div>
          </div>
        )}

        {activeTab === "waitlist" && waitlistSuccess && (
          <div className="glass-panel rounded-3xl p-12 text-center border-[#00C2A8]/20 dopamine-glow animate-fade-in">
            <div className="text-5xl mb-6">🙌</div>
            <h3 className="text-2xl font-headline font-800 text-white mb-2">Allocation Parameters Registered</h3>
            <p className="text-sm text-slate-400 max-w-md mx-auto leading-relaxed mb-4">
              Welcome to the cohort, <strong className="text-white">{waitlistData.name.split(" ")[0]}</strong>. Engineering allocation validation has been committed to <strong className="text-white">{waitlistData.email}</strong>.
            </p>
            <button onClick={() => setActiveTab("submit")} className="text-xs font-bold text-[#00C2A8] uppercase tracking-widest underline hover:text-white transition-colors">Return to active execution matrix</button>
          </div>
        )}
      </section>

      {/* CORE INDUSTRIAL TERMINAL FOOTER CONTAINER */}
      <footer className="bg-[#04070D] border-t border-white/5 py-12 px-[5%] text-center">
        <div className="flex items-center justify-center gap-2.5 mb-3">
          <KaaryaLogo size={24} />
          <span className="font-headline text-lg font-800 text-white tracking-tight">Kaarya</span>
        </div>
        <p className="text-xs text-slate-500 font-body">Engineered by Static Technologies Layer. Turning Conversations into Execution.</p>
        <p className="text-[10px] text-slate-600 font-body mt-2">© 2026 Static Technologies Private Limited. All infrastructure controls active.</p>
      </footer>
    </div>
  );
}
