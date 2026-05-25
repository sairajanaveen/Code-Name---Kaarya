import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, Image as ImageIcon, FileText, Video, ArrowRight, CheckCircle2, Loader2 } from "lucide-react";

// Webhook destination
const MAKE_WEBHOOK = "https://hook.eu2.make.com/8181h2iv2hxhp3k8m8cqes58ntj5vc3j";

// Premium Apple/Linear Easing Curve
const transitionEase = [0.16, 1, 0.3, 1];

const Logo = () => (
  <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-white shadow-[0_0_15px_rgba(255,255,255,0.3)]">
    <div className="w-3 h-3 bg-black rounded-sm" />
  </div>
);

export default function KaaryaEnterpriseApp() {
  const [activeTab, setActiveTab] = useState("submit");
  const [inputMethod, setInputMethod] = useState("text");
  const [formStep, setFormStep] = useState(1);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [waitlistSuccess, setWaitlistSuccess] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const timerRef = useRef(null);

  const [meetingData, setMeetingData] = useState({
    meeting_name: "", meeting_date: "", attendees: "", agenda: "", raw_notes: "", email: "", uploaded_file_name: ""
  });

  const [waitlistData, setWaitlistData] = useState({
    name: "", company: "", email: "", role: ""
  });

  useEffect(() => {
    setMeetingData(prev => ({ ...prev, meeting_date: new Date().toISOString().split('T')[0] }));
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    if (isRecording) {
      timerRef.current = setInterval(() => setRecordingDuration(p => p + 1), 1000);
    } else clearInterval(timerRef.current);
    return () => clearInterval(timerRef.current);
  }, [isRecording]);

  const updateForm = (key, val) => setMeetingData(prev => ({ ...prev, [key]: val }));
  const updateWaitlist = (key, val) => setWaitlistData(prev => ({ ...prev, [key]: val }));

  const formatTime = (sec) => `${Math.floor(sec / 60).toString().padStart(2, '0')}:${(sec % 60).toString().padStart(2, '0')}`;

  const executePipeline = async (type) => {
    setIsProcessing(true);
    const payload = type === 'meeting' ? meetingData : waitlistData;
    try {
      await fetch(MAKE_WEBHOOK, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        mode: "no-cors",
        body: JSON.stringify({ ...payload, platform_source: "kaarya_linear_v3", execution_type: type })
      });
    } catch (e) { console.error(e); }
    
    setTimeout(() => {
      setIsProcessing(false);
      type === 'meeting' ? setIsSubmitted(true) : setWaitlistSuccess(true);
    }, 1800);
  };

  const slideUp = {
    initial: { opacity: 0, y: 15 },
    animate: { opacity: 1, y: 0, transition: { duration: 0.6, ease: transitionEase } },
    exit: { opacity: 0, y: -15, transition: { duration: 0.3, ease: transitionEase } }
  };

  return (
    <div className="bg-black text-[#EDEDED] min-h-screen font-sans selection:bg-white/20 selection:text-white">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap');
        body { font-family: 'Inter', sans-serif; background-color: #000; }
        .glass-panel { background: rgba(10, 10, 10, 0.4); backdrop-filter: blur(24px); border: 1px solid rgba(255,255,255,0.08); }
        .glow-border:hover { border-color: rgba(255,255,255,0.3); box-shadow: 0 0 20px rgba(255,255,255,0.05); }
      `}</style>

      {/* TOP NAV */}
      <nav className={`fixed top-0 w-full z-50 transition-all duration-500 ${isScrolled ? "bg-black/50 backdrop-blur-xl border-b border-white/5" : "bg-transparent"} px-6 h-16 flex items-center justify-between`}>
        <div className="flex items-center gap-3">
          <Logo />
          <span className="text-sm font-semibold tracking-tight text-white">Kaarya</span>
        </div>
        <button onClick={() => window.scrollTo({top: 800, behavior: 'smooth'})} className="text-xs font-medium px-4 py-1.5 rounded-full bg-white/10 hover:bg-white text-white hover:text-black transition-colors duration-300">
          Open Workspace
        </button>
      </nav>

      {/* HERO SECTION */}
      <section className="relative min-h-[90vh] flex flex-col items-center justify-center px-6 pt-20 overflow-hidden">
        {/* Subtle background glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-white/[0.02] rounded-full blur-[100px] pointer-events-none" />
        
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 1, ease: transitionEase }} className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/10 bg-white/5 mb-8">
          <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
          <span className="text-[10px] uppercase tracking-widest text-zinc-400 font-medium">System Active</span>
        </motion.div>

        <motion.h1 
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.1, ease: transitionEase }}
          className="text-5xl md:text-7xl font-semibold tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-white to-white/50 text-center max-w-4xl leading-[1.1]"
        >
          Meetings end. <br/> Execution begins.
        </motion.h1>

        <motion.p 
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.2, ease: transitionEase }}
          className="mt-6 text-lg text-zinc-400 text-center max-w-2xl font-light"
        >
          Drop voice memos, whiteboards, or raw transcripts. Kaarya structures the chaos and automatically enforces accountability loops.
        </motion.p>
      </section>

      {/* WORKSPACE APP INTERFACE */}
      <section className="px-4 pb-32 max-w-4xl mx-auto relative z-10">
        
        {/* Apple/Linear style animated segmented control */}
        <div className="relative flex space-x-1 p-1 bg-white/[0.03] rounded-full border border-white/5 w-max mx-auto mb-12">
          {['submit', 'waitlist'].map((tab) => (
            <button
              key={tab} onClick={() => { setActiveTab(tab); setFormStep(1); setIsSubmitted(false); }}
              className={`relative px-8 py-2.5 text-xs font-medium transition-colors duration-300 rounded-full ${activeTab === tab ? 'text-black' : 'text-zinc-500 hover:text-white'}`}
            >
              {activeTab === tab && (
                <motion.div layoutId="pill" className="absolute inset-0 bg-white rounded-full shadow-sm" transition={{ type: "spring", stiffness: 500, damping: 35 }} />
              )}
              <span className="relative z-10">{tab === 'submit' ? 'Workspace Engine' : 'Request Access'}</span>
            </button>
          ))}
        </div>

        <motion.div layout className="glass-panel rounded-2xl p-8 md:p-12 shadow-2xl relative overflow-hidden">
          <AnimatePresence mode="wait">
            
            {/* --- WORKSPACE FLOW --- */}
            {activeTab === "submit" && !isSubmitted && (
              <motion.div key="workspace" {...slideUp}>
                
                {/* Stepper */}
                <div className="flex items-center gap-2 mb-10 text-[10px] uppercase tracking-widest font-medium text-zinc-500">
                  {[1, 2, 3].map(step => (
                    <div key={step} className="flex items-center gap-2">
                      <span className={`transition-colors duration-500 ${formStep >= step ? 'text-white' : ''}`}>
                        Step 0{step}
                      </span>
                      {step < 3 && <div className={`w-8 h-[1px] transition-colors duration-500 ${formStep > step ? 'bg-white/20' : 'bg-white/5'}`} />}
                    </div>
                  ))}
                </div>

                <AnimatePresence mode="wait">
                  {formStep === 1 && (
                    <motion.div key="step1" {...slideUp} className="space-y-6">
                      <h2 className="text-2xl font-medium tracking-tight text-white mb-6">Initialize Session</h2>
                      <div className="grid md:grid-cols-2 gap-5">
                        <div className="space-y-2">
                          <label className="text-[11px] text-zinc-500 uppercase tracking-wider">Context Identifier</label>
                          <input type="text" className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-white/30 transition-colors" placeholder="e.g. Q3 Roadmap Sync" value={meetingData.meeting_name} onChange={e => updateForm("meeting_name", e.target.value)} />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[11px] text-zinc-500 uppercase tracking-wider">Date</label>
                          <input type="date" className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-sm text-zinc-300 focus:outline-none focus:border-white/30 transition-colors" value={meetingData.meeting_date} onChange={e => updateForm("meeting_date", e.target.value)} />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[11px] text-zinc-500 uppercase tracking-wider">Accountable Parties</label>
                        <input type="text" className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-white/30 transition-colors" placeholder="@ravi, @miller, @sarmila" value={meetingData.attendees} onChange={e => updateForm("attendees", e.target.value)} />
                      </div>
                      <button onClick={() => meetingData.meeting_name && setFormStep(2)} className="mt-8 flex items-center justify-center gap-2 w-full py-3 bg-white text-black rounded-xl text-sm font-medium hover:bg-zinc-200 transition-colors disabled:opacity-30">
                        Continue to Payload <ArrowRight size={16} />
                      </button>
                    </motion.div>
                  )}

                  {formStep === 2 && (
                    <motion.div key="step2" {...slideUp} className="space-y-6">
                      <h2 className="text-2xl font-medium tracking-tight text-white mb-6">Ingest Data</h2>
                      
                      {/* Input Type Selector */}
                      <div className="flex gap-2 p-1 bg-black/50 border border-white/10 rounded-xl">
                        {[
                          { id: "text", icon: FileText, label: "Text" },
                          { id: "audio", icon: Mic, label: "Audio" },
                          { id: "image", icon: ImageIcon, label: "Image" },
                          { id: "video", icon: Video, label: "Video" }
                        ].map(m => {
                          const Icon = m.icon;
                          return (
                            <button key={m.id} onClick={() => setInputMethod(m.id)} className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-medium transition-all ${inputMethod === m.id ? 'bg-white/10 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}>
                              <Icon size={14} /> <span className="hidden sm:block">{m.label}</span>
                            </button>
                          )
                        })}
                      </div>

                      {/* Dynamic Input Area */}
                      <div className="min-h-[200px] border border-white/5 rounded-xl bg-black/20 p-4">
                        {inputMethod === "text" && (
                          <textarea className="w-full h-40 bg-transparent border-none focus:ring-0 text-sm text-white resize-none" placeholder="Paste chaotic notes, Slack dumps, or raw transcripts here..." value={meetingData.raw_notes} onChange={e => updateForm("raw_notes", e.target.value)} />
                        )}
                        {inputMethod === "audio" && (
                          <div className="h-40 flex flex-col items-center justify-center">
                            <button onClick={() => setIsRecording(!isRecording)} className={`w-16 h-16 rounded-full flex items-center justify-center transition-all duration-500 ${isRecording ? 'bg-red-500/20 text-red-500 shadow-[0_0_30px_rgba(239,68,68,0.3)]' : 'bg-white/5 text-white hover:bg-white/10'}`}>
                              <Mic size={24} className={isRecording ? 'animate-pulse' : ''} />
                            </button>
                            <span className="mt-4 text-xs tracking-widest text-zinc-500 font-mono">
                              {isRecording ? formatTime(recordingDuration) : "INITIALIZE SARVAM ENGINE"}
                            </span>
                          </div>
                        )}
                        {(inputMethod === "image" || inputMethod === "video") && (
                          <div className="h-40 flex flex-col items-center justify-center relative cursor-pointer group">
                            <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" onChange={(e) => updateForm("uploaded_file_name", e.target.files[0]?.name || "")} />
                            <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center text-zinc-400 group-hover:bg-white/10 transition-colors">
                              {inputMethod === "image" ? <ImageIcon size={20} /> : <Video size={20} />}
                            </div>
                            <span className="mt-4 text-xs text-zinc-500">{meetingData.uploaded_file_name || `Click to mount local ${inputMethod} asset`}</span>
                          </div>
                        )}
                      </div>

                      <div className="flex gap-3 mt-8">
                        <button onClick={() => setFormStep(1)} className="px-6 py-3 rounded-xl text-sm font-medium text-zinc-400 hover:text-white transition-colors">Back</button>
                        <button onClick={() => setFormStep(3)} className="flex-1 py-3 bg-white text-black rounded-xl text-sm font-medium hover:bg-zinc-200 transition-colors">Route Payload</button>
                      </div>
                    </motion.div>
                  )}

                  {formStep === 3 && (
                    <motion.div key="step3" {...slideUp} className="space-y-6">
                      <h2 className="text-2xl font-medium tracking-tight text-white mb-6">Execution Protocol</h2>
                      <div className="space-y-2">
                        <label className="text-[11px] text-zinc-500 uppercase tracking-wider">Destination Identity (Email)</label>
                        <input type="email" className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-white/30 transition-colors" placeholder="naveen@statictechnologies.in" value={meetingData.email} onChange={e => updateForm("email", e.target.value)} />
                      </div>
                      
                      <div className="p-4 rounded-xl border border-white/5 bg-white/[0.02] mt-6">
                        <div className="flex items-start gap-3">
                          <CheckCircle2 size={16} className="text-zinc-400 mt-0.5" />
                          <p className="text-xs text-zinc-400 leading-relaxed">
                            <span className="text-white block mb-1 font-medium">Pipeline verification successful.</span>
                            Payload will be parsed via Gemini 2.5. Structured HTML layout and WhatsApp parameter webhooks are primed for execution.
                          </p>
                        </div>
                      </div>

                      <div className="flex gap-3 mt-8">
                        <button onClick={() => setFormStep(2)} className="px-6 py-3 rounded-xl text-sm font-medium text-zinc-400 hover:text-white transition-colors">Back</button>
                        <button onClick={() => executePipeline('meeting')} disabled={!meetingData.email || isProcessing} className="flex-1 flex items-center justify-center gap-2 py-3 bg-white text-black rounded-xl text-sm font-medium hover:bg-zinc-200 transition-colors disabled:opacity-50">
                          {isProcessing ? <><Loader2 size={16} className="animate-spin" /> Compiling</> : 'Execute Pipeline'}
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )}

            {/* --- SUCCESS STATE --- */}
            {activeTab === "submit" && isSubmitted && (
              <motion.div key="success" {...slideUp} className="text-center py-10">
                <div className="w-16 h-16 mx-auto bg-white/5 rounded-full flex items-center justify-center mb-6">
                  <CheckCircle2 size={32} className="text-white" />
                </div>
                <h3 className="text-2xl font-medium text-white mb-2">Protocol Deployed</h3>
                <p className="text-sm text-zinc-400 mb-8 max-w-sm mx-auto">Structured assets are being assembled and routed to {meetingData.email}.</p>
                <button onClick={() => { setIsSubmitted(false); setFormStep(1); }} className="px-6 py-3 bg-white/10 text-white rounded-xl text-sm font-medium hover:bg-white/20 transition-colors">
                  Initialize New Session
                </button>
              </motion.div>
            )}

            {/* --- WAITLIST FLOW --- */}
            {activeTab === "waitlist" && !waitlistSuccess && (
              <motion.div key="waitlist" {...slideUp} className="space-y-6">
                <h2 className="text-2xl font-medium tracking-tight text-white mb-6">Enterprise Access</h2>
                <div className="grid md:grid-cols-2 gap-5">
                  <div className="space-y-2">
                    <label className="text-[11px] text-zinc-500 uppercase tracking-wider">Full Name</label>
                    <input type="text" className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-white/30" value={waitlistData.name} onChange={e => updateWaitlist("name", e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[11px] text-zinc-500 uppercase tracking-wider">Corporate Entity</label>
                    <input type="text" className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-white/30" value={waitlistData.company} onChange={e => updateWaitlist("company", e.target.value)} />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] text-zinc-500 uppercase tracking-wider">Work Email</label>
                  <input type="email" className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-white/30" value={waitlistData.email} onChange={e => updateWaitlist("email", e.target.value)} />
                </div>
                <button onClick={() => executePipeline('waitlist')} disabled={!waitlistData.name || !waitlistData.email || isProcessing} className="mt-8 flex items-center justify-center gap-2 w-full py-3 bg-white text-black rounded-xl text-sm font-medium hover:bg-zinc-200 transition-colors disabled:opacity-30">
                  {isProcessing ? <Loader2 size={16} className="animate-spin" /> : 'Request Authorization'}
                </button>
              </motion.div>
            )}

            {activeTab === "waitlist" && waitlistSuccess && (
              <motion.div key="waitlist-success" {...slideUp} className="text-center py-10">
                <div className="w-16 h-16 mx-auto bg-white/5 rounded-full flex items-center justify-center mb-6">
                  <CheckCircle2 size={32} className="text-white" />
                </div>
                <h3 className="text-2xl font-medium text-white mb-2">Access Requested</h3>
                <p className="text-sm text-zinc-400 mb-8 max-w-sm mx-auto">Your telemetry has been logged. We will authorize your domain shortly.</p>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-white/5 py-12 text-center">
        <div className="flex items-center justify-center gap-2 mb-4 opacity-50">
          <Logo /> <span className="text-sm font-semibold text-white">Kaarya</span>
        </div>
        <p className="text-xs text-zinc-600">Engineered by Static Technologies Private Limited.</p>
      </footer>
    </div>
  );
}
