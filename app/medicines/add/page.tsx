"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { MedicineInfo } from "@/lib/medicineDatabase";

const FREQUENCIES = [
  "Once daily","Twice daily","Three times daily","Four times daily",
  "Every morning","Every night at bedtime","Every 8 hours",
  "Every 12 hours","With meals","As needed",
];

function PrefillBanner() {
  return (
    <div style={{margin:"0 0 20px",padding:"12px 16px",borderRadius:12,background:"#e6f7f0",border:"1px solid rgba(22,163,106,0.3)",display:"flex",alignItems:"center",gap:12}}>
      <div style={{width:36,height:36,borderRadius:"50%",background:"rgba(22,163,106,0.15)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16A36A" strokeWidth="2.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
      </div>
      <div>
        <p style={{margin:0,fontSize:13,fontWeight:700,color:"#15803d"}}>Auto-filled from scan</p>
        <p style={{margin:0,fontSize:11,color:"#166534"}}>Please review and edit if needed before saving.</p>
      </div>
    </div>
  );
}

function MedicineForm({ prefilled, onBack }: { prefilled?: MedicineInfo; onBack: () => void }) {
  const [name, setName] = useState(prefilled?.name ?? "");
  const [dosage, setDosage] = useState(prefilled?.dosage ?? "");
  const [frequency, setFrequency] = useState(prefilled?.frequency ?? "Once daily");
  const [instructions, setInstructions] = useState(prefilled?.instructions ?? "");
  const [saved, setSaved] = useState(false);

  const inp: React.CSSProperties = {
    width:"100%",padding:"12px 14px",borderRadius:10,
    border:"1.5px solid #E5EAF0",fontSize:15,
    background:"#fff",color:"#172033",
    outline:"none",boxSizing:"border-box",fontFamily:"inherit",
  };
  const lbl: React.CSSProperties = {
    fontSize:12,fontWeight:700,color:"#718096",
    textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:6,display:"block",
  };

  if (saved) {
    return (
      <div style={{textAlign:"center",padding:"40px 0"}}>
        <div style={{width:68,height:68,borderRadius:"50%",background:"#e6f7f0",margin:"0 auto 16px",display:"flex",alignItems:"center",justifyContent:"center"}}>
          <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#16A36A" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
        </div>
        <h3 style={{margin:"0 0 6px",fontSize:20,fontWeight:700,color:"#172033"}}>{name} saved!</h3>
        <p style={{margin:0,fontSize:13,color:"#718096"}}>Medicine added to your list.</p>
      </div>
    );
  }

  return (
    <div>
      {prefilled && <PrefillBanner />}
      <div style={{display:"flex",flexDirection:"column",gap:18}}>
        <div>
          <label style={lbl}>Medicine Name</label>
          <input style={inp} value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Metformin" />
        </div>
        <div>
          <label style={lbl}>Dosage</label>
          <input style={inp} value={dosage} onChange={e=>setDosage(e.target.value)} placeholder="e.g. 500 mg" />
        </div>
        <div>
          <label style={lbl}>Frequency</label>
          <select style={{...inp,cursor:"pointer"}} value={frequency} onChange={e=>setFrequency(e.target.value)}>
            {FREQUENCIES.map(f=><option key={f} value={f}>{f}</option>)}
          </select>
        </div>
        <div>
          <label style={lbl}>Instructions (optional)</label>
          <textarea style={{...inp,minHeight:80,resize:"vertical"}} value={instructions} onChange={e=>setInstructions(e.target.value)} placeholder="e.g. Take with food" />
        </div>
        <button
          onClick={()=>{ if(name&&dosage) setSaved(true); }}
          disabled={!name||!dosage}
          style={{width:"100%",padding:"15px",borderRadius:12,border:"none",background:"#E31837",color:"#fff",fontSize:16,fontWeight:700,cursor:!name||!dosage?"not-allowed":"pointer",opacity:!name||!dosage?0.5:1,display:"flex",alignItems:"center",justifyContent:"center",gap:8}}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
          Save Medicine
        </button>
      </div>
    </div>
  );
}

function OptionCard({ icon, title, subtitle, badge, badgeColor, iconBg, iconColor, onClick, delay }:
  { icon: React.ReactNode; title: string; subtitle: string; badge?: string; badgeColor?: string; iconBg: string; iconColor: string; onClick: () => void; delay: number; }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={()=>setHovered(true)}
      onMouseLeave={()=>setHovered(false)}
      style={{
        width:"100%",padding:20,borderRadius:16,
        border: hovered ? "1.5px solid #C8D0DC" : "1.5px solid #E5EAF0",
        background:hovered?"#F5F7FA":"#fff",
        display:"flex",alignItems:"center",gap:16,cursor:"pointer",
        textAlign:"left",transition:"all 0.15s",
        boxShadow:hovered?"0 4px 16px rgba(23,32,51,0.08)":"0 1px 4px rgba(23,32,51,0.04)",
        animation:"fadeSlideIn 0.35s ease-out " + delay + "ms both",
      }}
    >
      <div style={{width:56,height:56,borderRadius:14,background:iconBg,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,color:iconColor}}>
        {icon}
      </div>
      <div style={{flex:1}}>
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:3}}>
          <span style={{fontSize:15,fontWeight:700,color:"#172033"}}>{title}</span>
          {badge && <span style={{fontSize:9,fontWeight:800,letterSpacing:"0.06em",padding:"2px 6px",borderRadius:5,background:badgeColor,color:"#fff"}}>{badge}</span>}
        </div>
        <span style={{fontSize:12,color:"#718096"}}>{subtitle}</span>
      </div>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#A0AABF" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
    </button>
  );
}

export default function AddMedicinePage({ searchParams }: { searchParams?: { name?:string; dosage?:string; frequency?:string; instructions?:string; } }) {
  const router = useRouter();
  const [mode, setMode] = useState<"pick"|"form">(searchParams?.name ? "form" : "pick");

  const prefilled: MedicineInfo | undefined = searchParams?.name
    ? { name: searchParams.name, dosage: searchParams.dosage??"", frequency: searchParams.frequency??"Once daily", instructions: searchParams.instructions??"" }
    : undefined;

  return (
    <div style={{minHeight:"100dvh",background:"#F5F7FA",fontFamily:"Inter,sans-serif"}}>
      <style>{`
        @keyframes fadeSlideIn { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
        input:focus, select:focus, textarea:focus { border-color:#E31837 !important; box-shadow:0 0 0 3px rgba(227,24,55,0.08); }
      `}</style>

      <header style={{background:"#fff",borderBottom:"1px solid #E5EAF0",padding:"0 24px",height:60,display:"flex",alignItems:"center",gap:14,position:"sticky",top:0,zIndex:20}}>
        <button
          onClick={()=>{ if(mode==="form"&&!prefilled) setMode("pick"); else router.back(); }}
          style={{width:36,height:36,borderRadius:9,border:"1px solid #E5EAF0",background:"#fff",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer"}}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#172033" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <div>
          <p style={{margin:0,fontSize:16,fontWeight:700,color:"#172033"}}>Add Medicine</p>
          <p style={{margin:0,fontSize:11,color:"#718096"}}>{mode==="pick"?"Choose how to add":"Fill in the details"}</p>
        </div>
      </header>

      <main style={{maxWidth:600,margin:"0 auto",padding:"28px 20px 60px"}}>
        {mode === "pick" ? (
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            <p style={{margin:"0 0 8px",fontSize:14,fontWeight:600,color:"#718096"}}>How would you like to add a medicine?</p>
            <OptionCard
              delay={0} iconBg="#fde8ec" iconColor="#E31837"
              icon={<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>}
              title="Manual Entry" subtitle="Type in the medicine details yourself"
              onClick={()=>setMode("form")}
            />
            <OptionCard
              delay={80} iconBg="#e8eef7" iconColor="#062F67"
              badge="FAST" badgeColor="#062F67"
              icon={<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M7 7h2v2H7zM7 11h2v2H7zM7 15h2v2H7zM11 7h2v2h-2z"/><line x1="15" y1="7" x2="20" y2="7"/><path d="M15 11h2v4h2v-2"/></svg>}
              title="Scan Barcode / QR Code" subtitle="Point camera at the medicine box or packet"
              onClick={()=>router.push("/medicines/add/scan-barcode")}
            />
            <OptionCard
              delay={160} iconBg="#fff3e0" iconColor="#e65100"
              badge="AI" badgeColor="#e65100"
              icon={<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>}
              title="Scan Prescription Label" subtitle="Upload or take a photo of your prescription"
              onClick={()=>router.push("/medicines/add/scan-prescription")}
            />
          </div>
        ) : (
          <MedicineForm prefilled={prefilled} onBack={()=>setMode("pick")} />
        )}
      </main>
    </div>
  );
}
