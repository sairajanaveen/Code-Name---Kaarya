import { useState, useEffect, useRef } from "react";

const MAKE_WEBHOOK = "https://hook.eu2.make.com/8181h2iv2hxhp3k8m8cqes58ntj5vc3j";

const KaaryaLogo = ({ size = 36, light = false }) => (
  <svg width={size} height={size} viewBox="0 0 48 48" fill="none">
    <rect width="48" height="48" rx="12" fill={light ? "#fff" : "#00C2A8"} fillOpacity={light ? 0.15 : 1} />
    <path d="M14 10 L14 38" stroke={light ? "#fff" : "#0A1F3D"} strokeWidth="3.5" strokeLinecap="round"/>
    <path d="M14 24 L30 10" stroke={light ? "#fff" : "#0A1F3D"} strokeWidth="3.5" strokeLinecap="round"/>
    <path d="M14 24 L32 38" stroke={light ? "#fff" : "#0A1F3D"} strokeWidth="3.5" strokeLinecap="round"/>
    <circle cx="35" cy="24" r="4" fill={light ? "#00C2A8" : "#F59E0B"}/>
  </svg>
);

export default function KaaryaApp() {
  const [tab, setTab] = useState("submit");
  const [step, setStep] = useState(1);
  const [submitted, setSubmitted] = useState(false);
  const [waitlistDone, setWaitlistDone] = useState(false);
  const [loading, setLoading] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const formRef = useRef(null);

  const [form, setForm] = useState({
    meeting_name: "", meeting_date: "", attendees: "",
    agenda: "", notes: "", email: ""
  });
  const [waitlist, setWaitlist] = useState({ name: "", org: "", email: "", role: "" });

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const setW = (k, v) => setWaitlist(w => ({ ...w, [k]: v }));

  const submitMeeting = async () => {
    setLoading(true);
    try {
      await fetch(MAKE_WEBHOOK, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        mode: "no-cors",
        body: JSON.stringify({ ...form, source: "kaarya_web", type: "meeting_submission" })
      });
    } catch (e) {}
    setTimeout(() => { setLoading(false); setSubmitted(true); }, 1200);
  };

  const submitWaitlist = async () => {
    setLoading(true);
    try {
      await fetch(MAKE_WEBHOOK, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        mode: "no-cors",
        body: JSON.stringify({ ...waitlist, source: "kaarya_web", type: "waitlist" })
      });
    } catch (e) {}
    setTimeout(() => { setLoading(false); setWaitlistDone(true); }, 1000);
  };

  const scrollToForm = (t) => {
    setTab(t);
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
  };

  const inp = {
    width: "100%", padding: "12px 16px", borderRadius: "10px",
    border: "1.5px solid #E2E8F0", background: "#F8FAFC",
    fontSize: "14px", color: "#1A1A2E", fontFamily: "inherit",
    outline: "none", boxSizing: "border-box", transition: "border 0.2s",
  };
  const lbl = { fontSize: "12px", fontWeight: "600", color: "#64748B", letterSpacing: "0.06em", textTransform: "uppercase", display: "block", marginBottom: "6px" };

  return (
    <div style={{ fontFamily: "'DM Sans', 'Segoe UI', sans-serif", background: "#F0F4F8", minHeight: "100vh" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=Syne:wght@700;800&display=swap');
        @keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-20px)} }
        @keyframes fadeUp { from{opacity:0;transform:translateY(24px)} to{opacity:1;transform:translateY(0)} }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
        @keyframes spin { to{transform:rotate(360deg)} }
        input:focus,textarea:focus,select:focus { border-color:#00C2A8!important; box-shadow:0 0 0 3px rgba(0,194,168,0.12)!important; }
        *{box-sizing:border-box;}
      `}</style>

      {/* NAV */}
      <nav style={{
        position:"fixed",top:0,left:0,right:0,zIndex:100,padding:"0 5%",
        background:scrolled?"rgba(10,31,61,0.97)":"transparent",
        backdropFilter:scrolled?"blur(12px)":"none",
        borderBottom:scrolled?"1px solid rgba(255,255,255,0.08)":"none",
        transition:"all 0.3s",display:"flex",alignItems:"center",
        justifyContent:"space-between",height:"68px",
      }}>
        <div style={{display:"flex",alignItems:"center",gap:"10px"}}>
          <KaaryaLogo size={36} light />
          <div>
            <div style={{fontSize:"18px",fontWeight:"800",color:"#fff",fontFamily:"'Syne',sans-serif",lineHeight:1}}>Kaarya</div>
            <div style={{fontSize:"9px",color:"#00C2A8",letterSpacing:"1.5px",textTransform:"uppercase"}}>by Static Technologies</div>
          </div>
        </div>
        <div style={{display:"flex",gap:"12px"}}>
          <button onClick={()=>scrollToForm("submit")} style={{padding:"8px 18px",border:"1px solid rgba(255,255,255,0.25)",borderRadius:"8px",background:"transparent",color:"#fff",fontSize:"13px",fontWeight:"500",cursor:"pointer"}}>Try free</button>
          <button onClick={()=>scrollToForm("waitlist")} style={{padding:"8px 18px",border:"none",borderRadius:"8px",background:"#00C2A8",color:"#0A1F3D",fontSize:"13px",fontWeight:"700",cursor:"pointer"}}>Early access</button>
        </div>
      </nav>

      {/* HERO */}
      <div style={{minHeight:"100vh",background:"#0A1F3D",backgroundImage:"radial-gradient(ellipse at 20% 50%,rgba(0,194,168,0.12) 0%,transparent 60%),radial-gradient(ellipse at 80% 20%,rgba(245,158,11,0.08) 0%,transparent 50%)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"120px 5% 80px",textAlign:"center",position:"relative",overflow:"hidden"}}>
        <div style={{position:"absolute",width:300,height:300,borderRadius:"50%",background:"rgba(0,194,168,0.08)",top:"-5%",right:"-3%",animation:"float 8s ease-in-out infinite"}}/>
        <div style={{position:"absolute",width:200,height:200,borderRadius:"50%",background:"rgba(0,194,168,0.06)",bottom:"5%",left:"-3%",animation:"float 10s ease-in-out infinite 3s"}}/>

        <div style={{display:"inline-flex",alignItems:"center",gap:"8px",background:"rgba(0,194,168,0.12)",border:"1px solid rgba(0,194,168,0.3)",borderRadius:"99px",padding:"6px 16px",marginBottom:"32px",animation:"fadeUp 0.7s ease both"}}>
          <span style={{width:6,height:6,borderRadius:"50%",background:"#00C2A8",animation:"pulse 2s infinite",display:"inline-block"}}/>
          <span style={{fontSize:"12px",color:"#00C2A8",fontWeight:"600",letterSpacing:"0.05em"}}>Now live · Vedanta Foundation pilot</span>
        </div>

        <h1 style={{fontFamily:"'Syne',sans-serif",fontSize:"clamp(36px,6vw,68px)",fontWeight:"800",color:"#fff",lineHeight:1.05,margin:"0 0 24px",maxWidth:"800px",animation:"fadeUp 0.7s ease both 0.1s",animationFillMode:"both"}}>
          Every meeting ends.<br/>
          <span style={{color:"#00C2A8"}}>Kaarya makes sure</span><br/>
          something happens next.
        </h1>

        <p style={{fontSize:"18px",color:"rgba(255,255,255,0.65)",lineHeight:1.7,maxWidth:"520px",margin:"0 0 48px",animation:"fadeUp 0.7s ease both 0.2s",animationFillMode:"both"}}>
          Paste rough meeting notes. Get a formatted MoM, action items, and WhatsApp reminders in under 60 seconds.
        </p>

        <div style={{display:"flex",gap:"14px",flexWrap:"wrap",justifyContent:"center",animation:"fadeUp 0.7s ease both 0.3s",animationFillMode:"both"}}>
          <button onClick={()=>scrollToForm("submit")} style={{padding:"14px 32px",borderRadius:"10px",border:"none",background:"#00C2A8",color:"#0A1F3D",fontSize:"15px",fontWeight:"700",cursor:"pointer"}}>Try with your next meeting →</button>
          <button onClick={()=>scrollToForm("waitlist")} style={{padding:"14px 32px",borderRadius:"10px",border:"1.5px solid rgba(255,255,255,0.2)",background:"transparent",color:"#fff",fontSize:"15px",fontWeight:"500",cursor:"pointer"}}>Join the waitlist</button>
        </div>

        <div style={{display:"flex",gap:"48px",marginTop:"72px",flexWrap:"wrap",justifyContent:"center"}}>
          {[["45 sec","MoM generated"],["95%","formatting accuracy"],["₹80/person","per month"],["0","new apps to learn"]].map(([n,l])=>(
            <div key={l} style={{textAlign:"center"}}>
              <div style={{fontSize:"28px",fontWeight:"800",color:"#fff",fontFamily:"'Syne',sans-serif"}}>{n}</div>
              <div style={{fontSize:"12px",color:"rgba(255,255,255,0.45)",marginTop:"4px"}}>{l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* HOW IT WORKS */}
      <div style={{padding:"80px 5%",background:"#fff"}}>
        <div style={{maxWidth:"900px",margin:"0 auto",textAlign:"center"}}>
          <div style={{fontSize:"11px",fontWeight:"700",color:"#00C2A8",letterSpacing:"2px",textTransform:"uppercase",marginBottom:"12px"}}>The Kaarya loop</div>
          <h2 style={{fontFamily:"'Syne',sans-serif",fontSize:"clamp(28px,4vw,42px)",fontWeight:"800",color:"#0A1F3D",margin:"0 0 48px"}}>From conversation to execution in three steps</h2>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(240px,1fr))",gap:"24px"}}>
            {[
              {n:"01",icon:"🎙",title:"Capture anything",body:"Voice, handwritten notes, Zoom transcript, or rough text. No special format needed.",color:"#EFF9F7"},
              {n:"02",icon:"🧠",title:"AI structures it",body:"Kaarya extracts decisions, action items, owners and deadlines in formal Indian MoM format.",color:"#FFF8EC"},
              {n:"03",icon:"⚡",title:"Team gets to work",body:"MoM emailed instantly. Each owner gets their task on WhatsApp. Reminders fire automatically.",color:"#EFF3FF"},
            ].map((s,i)=>(
              <div key={i} style={{background:s.color,borderRadius:"16px",padding:"32px 28px",textAlign:"left"}}>
                <div style={{fontSize:"11px",fontWeight:"800",color:"#CBD5E1",letterSpacing:"2px",marginBottom:"16px"}}>{s.n}</div>
                <div style={{fontSize:"32px",marginBottom:"14px"}}>{s.icon}</div>
                <div style={{fontSize:"17px",fontWeight:"700",color:"#0A1F3D",marginBottom:"8px"}}>{s.title}</div>
                <div style={{fontSize:"14px",color:"#64748B",lineHeight:1.7}}>{s.body}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* FORM SECTION */}
      <div ref={formRef} style={{padding:"80px 5%",background:"#F0F4F8"}}>
        <div style={{maxWidth:"660px",margin:"0 auto"}}>
          <div style={{display:"flex",gap:"0",marginBottom:"28px",background:"#fff",borderRadius:"12px",padding:"6px",boxShadow:"0 2px 8px rgba(0,0,0,0.06)"}}>
            {[["submit","📝 Submit a Meeting"],["waitlist","🚀 Get Early Access"]].map(([id,label])=>(
              <button key={id} onClick={()=>setTab(id)} style={{flex:1,padding:"12px",border:"none",borderRadius:"8px",cursor:"pointer",fontFamily:"inherit",fontSize:"14px",fontWeight:tab===id?"700":"500",background:tab===id?"#0A1F3D":"transparent",color:tab===id?"#fff":"#94A3B8",transition:"all 0.2s"}}>{label}</button>
            ))}
          </div>

          {tab==="submit"&&!submitted&&(
            <div style={{background:"#fff",borderRadius:"16px",padding:"40px",boxShadow:"0 4px 24px rgba(0,0,0,0.06)"}}>
              <h3 style={{fontFamily:"'Syne',sans-serif",fontSize:"22px",fontWeight:"800",color:"#0A1F3D",margin:"0 0 6px"}}>Submit your meeting</h3>
              <p style={{fontSize:"14px",color:"#94A3B8",margin:"0 0 28px"}}>Your MoM arrives in your inbox within 60 seconds.</p>

              <div style={{display:"flex",alignItems:"center",gap:"8px",marginBottom:"28px"}}>
                {[1,2,3].map(s=>(
                  <div key={s} style={{display:"flex",alignItems:"center",gap:"6px"}}>
                    <div onClick={()=>s<step&&setStep(s)} style={{width:"26px",height:"26px",borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",background:step>=s?"#0A1F3D":"#F1F5F9",color:step>=s?"#fff":"#CBD5E1",fontSize:"12px",fontWeight:"700",cursor:s<step?"pointer":"default"}}>
                      {step>s?"✓":s}
                    </div>
                    <span style={{fontSize:"12px",color:step>=s?"#0A1F3D":"#CBD5E1",fontWeight:step===s?"600":"400"}}>{s===1?"Details":s===2?"Notes":"Delivery"}</span>
                    {s<3&&<div style={{width:"20px",height:"2px",background:step>s?"#00C2A8":"#E2E8F0",borderRadius:"2px"}}/>}
                  </div>
                ))}
              </div>

              {step===1&&(
                <div style={{display:"flex",flexDirection:"column",gap:"16px"}}>
                  <div><label style={lbl}>Meeting Name *</label><input style={inp} value={form.meeting_name} onChange={e=>set("meeting_name",e.target.value)} placeholder="e.g. JobCliff Weekly Review — May 2026"/></div>
                  <div><label style={lbl}>Meeting Date *</label><input style={inp} type="date" value={form.meeting_date} onChange={e=>set("meeting_date",e.target.value)}/></div>
                  <div><label style={lbl}>Attendees *</label><input style={inp} value={form.attendees} onChange={e=>set("attendees",e.target.value)} placeholder="Ravi Krishnan, Miller Khandhar, Danish, Tahir"/></div>
                  <button onClick={()=>form.meeting_name&&form.meeting_date&&form.attendees&&setStep(2)} style={{padding:"14px",border:"none",borderRadius:"10px",cursor:"pointer",background:form.meeting_name&&form.meeting_date&&form.attendees?"#0A1F3D":"#E2E8F0",color:form.meeting_name&&form.meeting_date&&form.attendees?"#fff":"#94A3B8",fontSize:"14px",fontWeight:"700",fontFamily:"inherit"}}>Continue →</button>
                </div>
              )}

              {step===2&&(
                <div style={{display:"flex",flexDirection:"column",gap:"16px"}}>
                  <div><label style={lbl}>Agenda Items *</label><textarea style={{...inp,minHeight:"80px",resize:"vertical",lineHeight:1.6}} value={form.agenda} onChange={e=>set("agenda",e.target.value)} placeholder={"1. Platform update\n2. Deliverables review\n3. Targets Q2"}/></div>
                  <div><label style={lbl}>Rough Meeting Notes *</label><textarea style={{...inp,minHeight:"150px",resize:"vertical",lineHeight:1.7}} value={form.notes} onChange={e=>set("notes",e.target.value)} placeholder="Paste everything here — decisions, who said what, action items, any issues raised. The messier the better."/></div>
                  <div style={{display:"flex",gap:"10px"}}>
                    <button onClick={()=>setStep(1)} style={{padding:"14px 20px",border:"1.5px solid #E2E8F0",borderRadius:"10px",background:"#fff",color:"#64748B",fontSize:"14px",fontWeight:"600",cursor:"pointer",fontFamily:"inherit"}}>← Back</button>
                    <button onClick={()=>form.notes&&setStep(3)} style={{flex:1,padding:"14px",border:"none",borderRadius:"10px",cursor:"pointer",background:form.notes?"#0A1F3D":"#E2E8F0",color:form.notes?"#fff":"#94A3B8",fontSize:"14px",fontWeight:"700",fontFamily:"inherit"}}>Continue →</button>
                  </div>
                </div>
              )}

              {step===3&&(
                <div style={{display:"flex",flexDirection:"column",gap:"16px"}}>
                  <div><label style={lbl}>Your Email *</label><input style={inp} type="email" value={form.email} onChange={e=>set("email",e.target.value)} placeholder="yourname@organisation.com"/></div>
                  <div style={{background:"#F0F9F7",borderRadius:"10px",padding:"16px",border:"1px solid #C6EDE7"}}>
                    <div style={{fontSize:"13px",fontWeight:"600",color:"#0A6355",marginBottom:"6px"}}>✓ You'll receive in 60 seconds</div>
                    <div style={{fontSize:"12px",color:"#0A6355",lineHeight:1.8}}>• Formatted Minutes of Meeting<br/>• Action items with owners and deadlines<br/>• Decisions made — clear and numbered<br/>• Ready to forward to your team</div>
                  </div>
                  <div style={{display:"flex",gap:"10px"}}>
                    <button onClick={()=>setStep(2)} style={{padding:"14px 20px",border:"1.5px solid #E2E8F0",borderRadius:"10px",background:"#fff",color:"#64748B",fontSize:"14px",fontWeight:"600",cursor:"pointer",fontFamily:"inherit"}}>← Back</button>
                    <button onClick={submitMeeting} disabled={!form.email||loading} style={{flex:1,padding:"14px",border:"none",borderRadius:"10px",cursor:form.email?"pointer":"not-allowed",background:form.email?"#00C2A8":"#E2E8F0",color:form.email?"#0A1F3D":"#94A3B8",fontSize:"14px",fontWeight:"700",fontFamily:"inherit",display:"flex",alignItems:"center",justifyContent:"center",gap:"8px"}}>
                      {loading?<><span style={{width:16,height:16,border:"2px solid #0A1F3D",borderTopColor:"transparent",borderRadius:"50%",animation:"spin 0.8s linear infinite",display:"inline-block"}}/>Processing...</>:"Generate my MoM →"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {tab==="submit"&&submitted&&(
            <div style={{background:"#fff",borderRadius:"16px",padding:"56px 40px",textAlign:"center",boxShadow:"0 4px 24px rgba(0,0,0,0.06)"}}>
              <div style={{fontSize:"56px",marginBottom:"16px"}}>🎉</div>
              <h3 style={{fontFamily:"'Syne',sans-serif",fontSize:"22px",fontWeight:"800",color:"#0A1F3D",margin:"0 0 10px"}}>Your MoM is on its way</h3>
              <p style={{fontSize:"14px",color:"#64748B",lineHeight:1.7,margin:"0 0 28px"}}>Check <strong>{form.email}</strong> in the next 60 seconds.</p>
              <div style={{display:"flex",gap:"10px",justifyContent:"center"}}>
                <button onClick={()=>{setSubmitted(false);setStep(1);setForm({meeting_name:"",meeting_date:"",attendees:"",agenda:"",notes:"",email:""});}} style={{padding:"12px 24px",border:"1.5px solid #E2E8F0",borderRadius:"10px",background:"#fff",color:"#64748B",fontSize:"14px",fontWeight:"600",cursor:"pointer",fontFamily:"inherit"}}>Submit another</button>
                <button onClick={()=>setTab("waitlist")} style={{padding:"12px 24px",border:"none",borderRadius:"10px",background:"#0A1F3D",color:"#fff",fontSize:"14px",fontWeight:"700",cursor:"pointer",fontFamily:"inherit"}}>Join waitlist →</button>
              </div>
            </div>
          )}

          {tab==="waitlist"&&!waitlistDone&&(
            <div style={{background:"#fff",borderRadius:"16px",padding:"40px",boxShadow:"0 4px 24px rgba(0,0,0,0.06)"}}>
              <h3 style={{fontFamily:"'Syne',sans-serif",fontSize:"22px",fontWeight:"800",color:"#0A1F3D",margin:"0 0 6px"}}>Get early access</h3>
              <p style={{fontSize:"14px",color:"#94A3B8",margin:"0 0 28px"}}>First 50 teams get 3 months completely free.</p>
              <div style={{display:"flex",flexDirection:"column",gap:"16px"}}>
                <div><label style={lbl}>Your Name *</label><input style={inp} value={waitlist.name} onChange={e=>setW("name",e.target.value)} placeholder="Ravi Krishnan"/></div>
                <div><label style={lbl}>Organisation *</label><input style={inp} value={waitlist.org} onChange={e=>setW("org",e.target.value)} placeholder="Your Company / Organisation"/></div>
                <div><label style={lbl}>Your Role *</label>
                  <select style={{...inp,cursor:"pointer"}} value={waitlist.role} onChange={e=>setW("role",e.target.value)}>
                    <option value="">Select your role</option>
                    <option>CEO / Founder / Director</option>
                    <option>Executive Assistant / Admin</option>
                    <option>Team Lead / Manager</option>
                    <option>Project Manager</option>
                    <option>HR / Operations</option>
                    <option>Other</option>
                  </select>
                </div>
                <div><label style={lbl}>Work Email *</label><input style={inp} type="email" value={waitlist.email} onChange={e=>setW("email",e.target.value)} placeholder="you@yourcompany.com"/></div>
                <div style={{background:"#FFF8EC",borderRadius:"10px",padding:"14px",border:"1px solid #FDE9B4"}}>
                  <div style={{fontSize:"13px",color:"#92400E",fontWeight:"600"}}>🎁 First 50 teams get:</div>
                  <div style={{fontSize:"12px",color:"#92400E",lineHeight:1.8,marginTop:"4px"}}>• 3 months completely free<br/>• Personal onboarding by Naveen<br/>• Branded MoM template for your org<br/>• Direct input into product roadmap</div>
                </div>
                <button onClick={submitWaitlist} disabled={!waitlist.name||!waitlist.email||!waitlist.role||!waitlist.org||loading} style={{padding:"14px",border:"none",borderRadius:"10px",fontFamily:"inherit",cursor:"pointer",background:waitlist.name&&waitlist.email&&waitlist.role&&waitlist.org?"#00C2A8":"#E2E8F0",color:waitlist.name&&waitlist.email&&waitlist.role&&waitlist.org?"#0A1F3D":"#94A3B8",fontSize:"14px",fontWeight:"700",display:"flex",alignItems:"center",justifyContent:"center",gap:"8px"}}>
                  {loading?<><span style={{width:16,height:16,border:"2px solid #0A1F3D",borderTopColor:"transparent",borderRadius:"50%",animation:"spin 0.8s linear infinite",display:"inline-block"}}/>Saving...</>:"Claim my early access spot →"}
                </button>
              </div>
            </div>
          )}

          {tab==="waitlist"&&waitlistDone&&(
            <div style={{background:"#fff",borderRadius:"16px",padding:"56px 40px",textAlign:"center",boxShadow:"0 4px 24px rgba(0,0,0,0.06)"}}>
              <div style={{fontSize:"56px",marginBottom:"16px"}}>🙌</div>
              <h3 style={{fontFamily:"'Syne',sans-serif",fontSize:"22px",fontWeight:"800",color:"#0A1F3D",margin:"0 0 10px"}}>You're on the list, {waitlist.name.split(" ")[0]}!</h3>
              <p style={{fontSize:"14px",color:"#64748B",lineHeight:1.7,margin:"0 0 28px"}}>We'll reach out to <strong>{waitlist.email}</strong> personally within 48 hours.</p>
              <button onClick={()=>setTab("submit")} style={{padding:"12px 24px",border:"none",borderRadius:"10px",background:"#00C2A8",color:"#0A1F3D",fontSize:"14px",fontWeight:"700",cursor:"pointer",fontFamily:"inherit"}}>Try it now →</button>
            </div>
          )}
        </div>
      </div>

      {/* FOOTER */}
      <div style={{background:"#0A1F3D",padding:"40px 5%",textAlign:"center"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:"10px",marginBottom:"10px"}}>
          <KaaryaLogo size={28} light/>
          <span style={{fontFamily:"'Syne',sans-serif",fontSize:"16px",fontWeight:"800",color:"#fff"}}>Kaarya</span>
        </div>
        <p style={{fontSize:"13px",color:"rgba(255,255,255,0.35)",margin:"0 0 4px"}}>Turning Conversations into Execution</p>
        <p style={{fontSize:"12px",color:"rgba(255,255,255,0.2)",margin:0}}>© 2026 Static Technologies · All rights reserved</p>
      </div>
    </div>
  );
}
