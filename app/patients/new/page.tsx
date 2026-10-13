"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { addPatient } from "@/lib/storage";

const COMMON_CONDITIONS = [
  "Type 2 Diabetes","Hypertension","Heart Failure","COPD","Asthma",
  "Hypothyroidism","Parkinson's Disease","Dementia","Rheumatoid Arthritis",
  "Chronic Kidney Disease","Depression","Osteoporosis","Anaemia",
];

export default function NewPatientPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [phone, setPhone] = useState("");
  const [condInput, setCondInput] = useState("");
  const [conditions, setConditions] = useState<string[]>([]);
  const [hasDiabetes, setHasDiabetes] = useState(false);
  const [hasHypertension, setHasHypertension] = useState(false);
  const [isDeaf, setIsDeaf] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function addCondition(c: string) {
    const trimmed = c.trim();
    if (trimmed && !conditions.includes(trimmed)) {
      setConditions(prev => [...prev, trimmed]);
      if (/diabetes/i.test(trimmed)) setHasDiabetes(true);
      if (/hypertension|blood pressure/i.test(trimmed)) setHasHypertension(true);
      if (/deaf|hearing/i.test(trimmed)) setIsDeaf(true);
    }
    setCondInput("");
  }

  function handleCondKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addCondition(condInput); }
    if (e.key === "Backspace" && !condInput) setConditions(prev => prev.slice(0,-1));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError("Patient name is required."); return; }
    setSaving(true);
    addPatient({
      name: name.trim(),
      age: age ? Number(age) : null,
      phone: phone.trim(),
      conditions,
      hasDiabetes,
      hasHypertension,
      isDeaf,
    });
    sessionStorage.setItem("raksha_toast", name.trim() + " added successfully!");
    router.push("/patients");
  }

  const inp: React.CSSProperties = {
    width:"100%", padding:"11px 14px", borderRadius:10,
    border:"1.5px solid #E5E7EB", fontSize:14, outline:"none",
    color:"#111827", background:"#fff", transition:"border-color 0.15s",
    fontFamily:"inherit",
  };
  const lbl: React.CSSProperties = {
    display:"block", fontSize:12, fontWeight:700, color:"#374151",
    marginBottom:6, letterSpacing:"0.04em", textTransform:"uppercase",
  };

  return (
    <div style={{ minHeight:"100vh", background:"#F9FAFB", fontFamily:"Inter,ui-sans-serif,system-ui,sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        * { box-sizing:border-box; }
        input:focus, textarea:focus { border-color:#0D9488 !important; box-shadow:0 0 0 3px rgba(13,148,136,0.1); }
        @keyframes fadeUp { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        .fade-up { animation:fadeUp 0.3s ease-out both; }
      `}</style>

      <header style={{ background:"#fff", borderBottom:"1px solid #E5E7EB", padding:"0 32px",
        height:60, display:"flex", alignItems:"center", gap:14,
        position:"sticky", top:0, zIndex:30, boxShadow:"0 1px 3px rgba(0,0,0,0.04)" }}>
        <Link href="/patients" style={{ width:34, height:34, borderRadius:9, border:"1px solid #E5E7EB",
          background:"#fff", display:"flex", alignItems:"center", justifyContent:"center", textDecoration:"none" }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
        </Link>
        <div style={{ width:1, height:20, background:"#E5E7EB" }} />
        <Link href="/patients" style={{ fontSize:13, color:"#6B7280", textDecoration:"none" }}>Patients</Link>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#D1D5DB" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
        <span style={{ fontSize:13, fontWeight:600, color:"#111827" }}>Add New Patient</span>
      </header>

      <main style={{ maxWidth:560, margin:"40px auto", padding:"0 24px" }}>
        <div style={{ background:"#fff", border:"1px solid #E5E7EB", borderRadius:18,
          padding:"32px 36px", boxShadow:"0 2px 8px rgba(0,0,0,0.06)" }} className="fade-up">
          <h1 style={{ margin:"0 0 6px", fontSize:20, fontWeight:800, color:"#111827", letterSpacing:"-0.02em" }}>Add New Patient</h1>
          <p style={{ margin:"0 0 28px", fontSize:13, color:"#9CA3AF" }}>Fill in the patient details below. Only name is required.</p>

          <form onSubmit={handleSubmit} style={{ display:"flex", flexDirection:"column", gap:20 }}>
            {error && <div style={{ padding:"10px 14px", borderRadius:9, background:"#FEE2E2",
              color:"#DC2626", fontSize:13, fontWeight:600 }}>{error}</div>}

            <div>
              <label style={lbl}>Full Name *</label>
              <input value={name} onChange={e=>{setName(e.target.value);setError("");}}
                placeholder="e.g. Kamala Devi" style={inp} autoFocus />
            </div>

            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
              <div>
                <label style={lbl}>Age</label>
                <input value={age} onChange={e=>setAge(e.target.value)}
                  type="number" min="0" max="130" placeholder="e.g. 72" style={inp} />
              </div>
              <div>
                <label style={lbl}>Phone</label>
                <input value={phone} onChange={e=>setPhone(e.target.value)}
                  placeholder="+91 98765 43210" style={inp} />
              </div>
            </div>

            <div>
              <label style={lbl}>Conditions</label>
              <div style={{ border:"1.5px solid #E5E7EB", borderRadius:10, padding:"8px 10px",
                display:"flex", flexWrap:"wrap", gap:6, minHeight:46, background:"#fff",
                cursor:"text", transition:"border-color 0.15s" }}
                onClick={e=>(e.currentTarget.querySelector("input") as HTMLInputElement)?.focus()}>
                {conditions.map(c => (
                  <span key={c} style={{ display:"inline-flex", alignItems:"center", gap:5,
                    padding:"3px 10px", borderRadius:999, background:"#CCFBF1", color:"#0D9488",
                    fontSize:12, fontWeight:600 }}>
                    {c}
                    <button type="button" onClick={()=>setConditions(prev=>prev.filter(x=>x!==c))}
                      style={{ border:"none", background:"none", cursor:"pointer", color:"#0D9488",
                        padding:0, lineHeight:1, fontSize:14 }}>×</button>
                  </span>
                ))}
                <input value={condInput} onChange={e=>setCondInput(e.target.value)}
                  onKeyDown={handleCondKeyDown} onBlur={()=>{if(condInput.trim())addCondition(condInput);}}
                  placeholder={conditions.length===0?"Type condition, press Enter…":""}
                  style={{ border:"none", outline:"none", fontSize:13, flex:1, minWidth:140,
                    background:"transparent", fontFamily:"inherit", color:"#111827" }} />
              </div>
              <p style={{ margin:"6px 0 0", fontSize:11, color:"#9CA3AF" }}>Press Enter or comma to add. Or click below:</p>
              <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginTop:8 }}>
                {COMMON_CONDITIONS.filter(c=>!conditions.includes(c)).slice(0,8).map(c => (
                  <button key={c} type="button" onClick={()=>addCondition(c)}
                    style={{ padding:"3px 10px", borderRadius:999, border:"1px solid #D1FAE5",
                      background:"#F0FDF4", color:"#059669", fontSize:11, fontWeight:600, cursor:"pointer" }}>
                    + {c}
                  </button>
                ))}
              </div>
            </div>

            {/* Vitals Tracking Indicators */}
            <div style={{ background: "#F0FDFA", border: "1.5px solid #99F6E4", borderRadius: 12, padding: "16px 18px" }}>
              <p style={{ ...lbl, color: "#0D9488", marginBottom: 6 }}>Vitals Monitoring Setup</p>
              <p style={{ margin: "0 0 14px", fontSize: 12, color: "#4B5563" }}>
                Enable tracking indicators for routine blood sugar and blood pressure vitals logs:
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <label style={{
                  display: "flex", alignItems: "center", gap: 10, padding: "10px 14px",
                  borderRadius: 10, background: "#fff", border: hasDiabetes ? "1.5px solid #0D9488" : "1.5px solid #E5E7EB",
                  cursor: "pointer", transition: "all 0.15s"
                }}>
                  <input
                    type="checkbox"
                    checked={hasDiabetes}
                    onChange={e => setHasDiabetes(e.target.checked)}
                    style={{ width: 18, height: 18, accentColor: "#0D9488", cursor: "pointer" }}
                  />
                  <div>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#111827", display: "block" }}>
                      Has Diabetes
                    </span>
                    <span style={{ fontSize: 11, color: "#6B7280" }}>Track Blood Sugar</span>
                  </div>
                </label>

                <label style={{
                  display: "flex", alignItems: "center", gap: 10, padding: "10px 14px",
                  borderRadius: 10, background: "#fff", border: hasHypertension ? "1.5px solid #0D9488" : "1.5px solid #E5E7EB",
                  cursor: "pointer", transition: "all 0.15s"
                }}>
                  <input
                    type="checkbox"
                    checked={hasHypertension}
                    onChange={e => setHasHypertension(e.target.checked)}
                    style={{ width: 18, height: 18, accentColor: "#0D9488", cursor: "pointer" }}
                  />
                  <div>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#111827", display: "block" }}>
                      Has Hypertension
                    </span>
                    <span style={{ fontSize: 11, color: "#6B7280" }}>Track Blood Pressure</span>
                  </div>
                </label>
              </div>
            </div>

            {/* Hearing Accessibility Setup for Deaf Patients */}
            <div style={{ background: "#EEF2FF", border: isDeaf ? "1.5px solid #6366F1" : "1.5px solid #C7D2FE", borderRadius: 12, padding: "16px 18px", transition: "all 0.15s" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                <p style={{ ...lbl, color: "#4F46E5", margin: 0 }}>Hearing Accessibility</p>
                <span style={{ fontSize: 11, background: "#E0E7FF", color: "#4338CA", padding: "2px 8px", borderRadius: 6, fontWeight: 700 }}>
                  SMS & Telegram
                </span>
              </div>
              <p style={{ margin: "0 0 12px", fontSize: 12, color: "#4B5563" }}>
                For deaf or hard of hearing patients who cannot receive voice calls, Raksha sends direct medication reminders via SMS and Telegram with reply instructions ("Reply 1 if taken, 2 if not taken").
              </p>
              <label style={{
                display: "flex", alignItems: "flex-start", gap: 12, padding: "12px 14px",
                borderRadius: 10, background: "#fff", border: isDeaf ? "1.5px solid #4F46E5" : "1.5px solid #E5E7EB",
                cursor: "pointer", transition: "all 0.15s"
              }}>
                <input
                  type="checkbox"
                  checked={isDeaf}
                  onChange={e => setIsDeaf(e.target.checked)}
                  style={{ width: 18, height: 18, accentColor: "#4F46E5", cursor: "pointer", marginTop: 2 }}
                />
                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#111827", display: "block" }}>
                    Patient is Deaf / Cannot Receive Voice Calls 🧏
                  </span>
                  <span style={{ fontSize: 11, color: "#6B7280", lineHeight: 1.4, display: "block", marginTop: 2 }}>
                    Automatically switches to SMS & Telegram medication check (press 1 if taken, 2 if not) instead of voice calls.
                  </span>
                </div>
              </label>
            </div>

            <div style={{ display:"flex", gap:10, paddingTop:8, borderTop:"1px solid #F3F4F6", marginTop:4 }}>
              <Link href="/patients" style={{ flex:1, padding:"12px", borderRadius:10,
                border:"1.5px solid #E5E7EB", background:"#fff", color:"#6B7280",
                textDecoration:"none", fontSize:14, fontWeight:700, textAlign:"center" }}>
                Cancel
              </Link>
              <button type="submit" disabled={saving || !name.trim()}
                style={{ flex:2, padding:"12px", borderRadius:10, border:"none",
                  background: name.trim() ? "#0D9488" : "#D1D5DB",
                  color:"#fff", fontSize:14, fontWeight:700, cursor: name.trim() ? "pointer":"not-allowed",
                  transition:"background 0.15s" }}>
                {saving ? "Saving…" : "Save Patient"}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
