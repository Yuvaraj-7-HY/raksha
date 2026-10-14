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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError("Patient name is required."); return; }
    setSaving(true);
    setError("");

    try {
      // 1. Persist to Supabase backend
      const res = await fetch("/api/patients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          age: age ? Number(age) : null,
          phone: phone.trim(),
          conditions,
          hasDiabetes,
          hasHypertension,
          isDeaf,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to create patient");
      }

      // 2. Also save to local storage for instant sync
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
    } catch (err: any) {
      console.error("Error creating patient:", err);
      setError(err.message || "Failed to save patient. Please try again.");
      setSaving(false);
    }
  }

  const inp: React.CSSProperties = {
    width:"100%", padding:"11px 14px", borderRadius:10,
    border:"1.5px solid #7DD3FC", fontSize:14, outline:"none",
    color:"#083457", background:"#F0F9FF", transition:"border-color 0.15s",
    fontFamily:"inherit",
  };
  const lbl: React.CSSProperties = {
    display:"block", fontSize:12, fontWeight:700, color:"#083457",
    marginBottom:6, letterSpacing:"0.04em", textTransform:"uppercase",
  };

  return (
    <div style={{ minHeight:"100vh", background:"linear-gradient(180deg, #BAE6FD 0%, #D4EEFD 40%, #C3E5FC 100%)", color:"#083457", fontFamily:"Inter,ui-sans-serif,system-ui,sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        * { box-sizing:border-box; }
        input:focus, textarea:focus { border-color:#1DA1F2 !important; box-shadow:0 0 0 3px rgba(29,161,242,0.25); }
        @keyframes fadeUp { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        .fade-up { animation:fadeUp 0.3s ease-out both; }
      `}</style>

      <header style={{ background:"linear-gradient(135deg, #1DA1F2 0%, #0C85D0 100%)", borderBottom:"2px solid #0A72B3", padding:"0 32px",
        height:60, display:"flex", alignItems:"center", gap:14,
        position:"sticky", top:0, zIndex:30, boxShadow:"0 4px 16px rgba(12,133,208,0.25)" }}>
        <Link href="/patients" style={{ width:34, height:34, borderRadius:9, border:"1px solid rgba(255,255,255,0.4)",
          background:"rgba(8, 52, 87, 0.3)", display:"flex", alignItems:"center", justifyContent:"center", textDecoration:"none" }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
        </Link>
        <div style={{ width:1, height:20, background:"rgba(255,255,255,0.3)" }} />
        <Link href="/patients" style={{ fontSize:13, color:"#E0F2FE", textDecoration:"none", fontWeight: 600 }}>Patients</Link>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#BAE6FD" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
        <span style={{ fontSize:13, fontWeight:700, color:"#FFFFFF" }}>Add New Patient</span>
      </header>

      <main style={{ maxWidth:560, margin:"40px auto", padding:"0 24px" }}>
        <div style={{ background:"#EDF7FE", border:"1.5px solid #7DD3FC", borderRadius:18,
          padding:"32px 36px", boxShadow:"0 4px 24px rgba(12, 133, 208, 0.14)" }} className="fade-up">
          <h1 style={{ margin:"0 0 6px", fontSize:20, fontWeight:800, color:"#083457", letterSpacing:"-0.02em" }}>Add New Patient</h1>
          <p style={{ margin:"0 0 28px", fontSize:13, color:"#12578A" }}>Fill in the patient details below. Only name is required.</p>

          <form onSubmit={handleSubmit} style={{ display:"flex", flexDirection:"column", gap:20 }}>
            {error && <div style={{ padding:"10px 14px", borderRadius:9, background:"#FEE2E2",
              border:"1px solid #FCA5A5", color:"#B91C1C", fontSize:13, fontWeight:600 }}>{error}</div>}

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
              <div style={{ border:"1.5px solid #7DD3FC", borderRadius:10, padding:"8px 10px",
                display:"flex", flexWrap:"wrap", gap:6, minHeight:46, background:"#F0F9FF",
                cursor:"text", transition:"border-color 0.15s" }}
                onClick={e=>(e.currentTarget.querySelector("input") as HTMLInputElement)?.focus()}>
                {conditions.map(c => (
                  <span key={c} style={{ display:"inline-flex", alignItems:"center", gap:5,
                    padding:"4px 10px", borderRadius:999, background:"#BAE6FD", color:"#083457",
                    border:"1px solid #7DD3FC", fontSize:12, fontWeight:700 }}>
                    {c}
                    <button type="button" onClick={()=>setConditions(prev=>prev.filter(x=>x!==c))}
                      style={{ border:"none", background:"none", cursor:"pointer", color:"#083457",
                        padding:0, lineHeight:1, fontSize:14 }}>×</button>
                  </span>
                ))}
                <input value={condInput} onChange={e=>setCondInput(e.target.value)}
                  onKeyDown={handleCondKeyDown} onBlur={()=>{if(condInput.trim())addCondition(condInput);}}
                  placeholder={conditions.length===0?"Type condition, press Enter…":""}
                  style={{ border:"none", outline:"none", fontSize:13, flex:1, minWidth:140,
                    background:"transparent", fontFamily:"inherit", color:"#083457" }} />
              </div>
              <p style={{ margin:"6px 0 0", fontSize:11, color:"#12578A" }}>Press Enter or comma to add. Or click below:</p>
              <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginTop:8 }}>
                {COMMON_CONDITIONS.filter(c=>!conditions.includes(c)).slice(0,8).map(c => (
                  <button key={c} type="button" onClick={()=>addCondition(c)}
                    style={{ padding:"4px 10px", borderRadius:999, border:"1px solid #7DD3FC",
                      background:"#E0F2FE", color:"#083457", fontSize:11, fontWeight:700, cursor:"pointer" }}>
                    + {c}
                  </button>
                ))}
              </div>
            </div>

            {/* Vitals Tracking Indicators */}
            <div style={{ background: "#E0F2FE", border: "1.5px solid #7DD3FC", borderRadius: 12, padding: "16px 18px" }}>
              <p style={{ ...lbl, color: "#083457", marginBottom: 6 }}>Vitals Monitoring Setup</p>
              <p style={{ margin: "0 0 14px", fontSize: 12, color: "#12578A" }}>
                Enable tracking indicators for routine blood sugar and blood pressure vitals logs:
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <label style={{
                  display: "flex", alignItems: "center", gap: 10, padding: "10px 14px",
                  borderRadius: 10, background: "#F0F9FF", border: hasDiabetes ? "2px solid #1DA1F2" : "1.5px solid #BAE6FD",
                  cursor: "pointer", transition: "all 0.15s"
                }}>
                  <input
                    type="checkbox"
                    checked={hasDiabetes}
                    onChange={e => setHasDiabetes(e.target.checked)}
                    style={{ width: 18, height: 18, accentColor: "#1DA1F2", cursor: "pointer" }}
                  />
                  <div>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#083457", display: "block" }}>
                      Has Diabetes
                    </span>
                    <span style={{ fontSize: 11, color: "#12578A" }}>Track Blood Sugar</span>
                  </div>
                </label>

                <label style={{
                  display: "flex", alignItems: "center", gap: 10, padding: "10px 14px",
                  borderRadius: 10, background: "#F0F9FF", border: hasHypertension ? "2px solid #1DA1F2" : "1.5px solid #BAE6FD",
                  cursor: "pointer", transition: "all 0.15s"
                }}>
                  <input
                    type="checkbox"
                    checked={hasHypertension}
                    onChange={e => setHasHypertension(e.target.checked)}
                    style={{ width: 18, height: 18, accentColor: "#1DA1F2", cursor: "pointer" }}
                  />
                  <div>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#083457", display: "block" }}>
                      Has Hypertension
                    </span>
                    <span style={{ fontSize: 11, color: "#12578A" }}>Track Blood Pressure</span>
                  </div>
                </label>
              </div>
            </div>

            {/* Hearing Accessibility Setup for Deaf Patients */}
            <div style={{ background: "#E0F2FE", border: isDeaf ? "2px solid #1DA1F2" : "1.5px solid #7DD3FC", borderRadius: 12, padding: "16px 18px", transition: "all 0.15s" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                <p style={{ ...lbl, color: "#083457", margin: 0 }}>Hearing Accessibility</p>
                <span style={{ fontSize: 11, background: "#BAE6FD", color: "#083457", padding: "3px 8px", borderRadius: 6, fontWeight: 700, border: "1px solid #7DD3FC" }}>
                  SMS & Telegram
                </span>
              </div>
              <p style={{ margin: "0 0 12px", fontSize: 12, color: "#12578A" }}>
                For deaf or hard of hearing patients who cannot receive voice calls, Raksha sends direct medication reminders via SMS and Telegram with reply instructions (&ldquo;Reply 1 if taken, 2 if not taken&rdquo;).
              </p>
              <label style={{
                display: "flex", alignItems: "flex-start", gap: 12, padding: "12px 14px",
                borderRadius: 10, background: "#F0F9FF", border: isDeaf ? "2px solid #1DA1F2" : "1.5px solid #BAE6FD",
                cursor: "pointer", transition: "all 0.15s"
              }}>
                <input
                  type="checkbox"
                  checked={isDeaf}
                  onChange={e => setIsDeaf(e.target.checked)}
                  style={{ width: 18, height: 18, accentColor: "#1DA1F2", cursor: "pointer", marginTop: 2 }}
                />
                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#083457", display: "block" }}>
                    Patient is Deaf / Cannot Receive Voice Calls 🧏
                  </span>
                  <span style={{ fontSize: 11, color: "#12578A", lineHeight: 1.4, display: "block", marginTop: 2 }}>
                    Automatically switches to SMS & Telegram medication check (press 1 if taken, 2 if not) instead of voice calls.
                  </span>
                </div>
              </label>
            </div>

            <div style={{ display:"flex", gap:10, paddingTop:12, borderTop:"1.5px solid #BAE6FD", marginTop:4 }}>
              <Link href="/patients" style={{ flex:1, padding:"12px", borderRadius:10,
                border:"1.5px solid #7DD3FC", background:"#E0F2FE", color:"#083457",
                textDecoration:"none", fontSize:14, fontWeight:700, textAlign:"center" }}>
                Cancel
              </Link>
              <button type="submit" disabled={saving || !name.trim()}
                style={{ flex:2, padding:"12px", borderRadius:10, border:"none",
                  background: name.trim() ? "linear-gradient(135deg, #1DA1F2 0%, #0C85D0 100%)" : "#BAE6FD",
                  color: name.trim() ? "#FFFFFF" : "#083457", fontSize:14, fontWeight:700, cursor: name.trim() ? "pointer":"not-allowed",
                  boxShadow: name.trim() ? "0 4px 14px rgba(12, 133, 208, 0.3)" : "none",
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
