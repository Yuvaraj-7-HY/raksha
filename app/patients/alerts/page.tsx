"use client";

import Link from "next/link";
import { ESCALATION_LOGS, PATIENTS, timeAgo } from "@/lib/patients";

function TypeBadge({ type }: { type: "sms"|"call"|"family_alert" }) {
  const cfg = {
    sms:          { bg:"#EFF6FF", color:"#2563EB", label:"SMS", icon:"💬" },
    call:         { bg:"#FEE2E2", color:"#DC2626", label:"Call", icon:"📞" },
    family_alert: { bg:"#FEF3C7", color:"#D97706", label:"Family Alert", icon:"🔔" },
  }[type];
  return (
    <span style={{ display:"inline-flex", alignItems:"center", gap:5, padding:"3px 10px",
      borderRadius:999, background:cfg.bg, color:cfg.color, fontSize:11, fontWeight:700 }}>
      {cfg.icon} {cfg.label}
    </span>
  );
}

function StatusDot({ status }: { status:"delivered"|"failed"|"pending" }) {
  const cfg = {
    delivered: { color:"#059669", label:"Delivered" },
    failed:    { color:"#DC2626", label:"Failed" },
    pending:   { color:"#D97706", label:"Pending" },
  }[status];
  return (
    <span style={{ display:"inline-flex", alignItems:"center", gap:5, fontSize:12, color:cfg.color, fontWeight:600 }}>
      <span style={{ width:7, height:7, borderRadius:"50%", background:cfg.color }} />
      {cfg.label}
    </span>
  );
}

export default function AlertsPage() {
  const today = new Date().toLocaleDateString("en-IN", { weekday:"long", day:"numeric", month:"long", year:"numeric" });

  return (
    <div style={{ minHeight:"100vh", background:"#F9FAFB", fontFamily:"Inter,ui-sans-serif,system-ui,sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        * { box-sizing:border-box; }
        @keyframes fadeUp { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        .fade-up { animation:fadeUp 0.35s ease-out both; }
        .alert-row:hover { background:#F9FAFB !important; }
      `}</style>

      {/* Header */}
      <header style={{ background:"#fff", borderBottom:"1px solid #E5E7EB", padding:"0 32px",
        height:64, display:"flex", alignItems:"center", justifyContent:"space-between",
        position:"sticky", top:0, zIndex:30, boxShadow:"0 1px 4px rgba(0,0,0,0.04)" }}>
        <div style={{ display:"flex", alignItems:"center", gap:14 }}>
          <div style={{ width:36, height:36, borderRadius:10, background:"#FEF3C7",
            display:"flex", alignItems:"center", justifyContent:"center", fontSize:18 }}>🔔</div>
          <div>
            <p style={{ margin:0, fontSize:17, fontWeight:800, color:"#111827", letterSpacing:"-0.02em" }}>Alerts & Escalation Log</p>
            <p style={{ margin:0, fontSize:11, color:"#9CA3AF" }}>{today}</p>
          </div>
        </div>
        <Link href="/patients" style={{ display:"inline-flex", alignItems:"center", gap:6,
          padding:"7px 14px", borderRadius:8, border:"1px solid #E5E7EB", background:"#fff",
          color:"#6B7280", textDecoration:"none", fontSize:12, fontWeight:600 }}>
          ← Patient List
        </Link>
      </header>

      <main style={{ maxWidth:900, margin:"0 auto", padding:"32px 24px" }}>

        {/* Summary strip */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:14, marginBottom:24 }} className="fade-up">
          {[
            { label:"Total Escalations", value:ESCALATION_LOGS.length, color:"#111827" },
            { label:"Delivered", value:ESCALATION_LOGS.filter(e=>e.status==="delivered").length, color:"#059669" },
            { label:"Failed", value:ESCALATION_LOGS.filter(e=>e.status==="failed").length, color:"#DC2626" },
          ].map(s => (
            <div key={s.label} style={{ background:"#fff", border:"1px solid #E5E7EB", borderRadius:12,
              padding:"16px 20px", boxShadow:"0 1px 3px rgba(0,0,0,0.05)" }}>
              <p style={{ margin:"0 0 4px", fontSize:11, fontWeight:600, color:"#6B7280", textTransform:"uppercase", letterSpacing:"0.06em" }}>{s.label}</p>
              <p style={{ margin:0, fontSize:28, fontWeight:800, color:s.color, letterSpacing:"-0.03em" }}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Log table */}
        <div style={{ background:"#fff", border:"1px solid #E5E7EB", borderRadius:16,
          boxShadow:"0 1px 4px rgba(0,0,0,0.05)", overflow:"hidden" }} className="fade-up">
          <div style={{ padding:"18px 22px", borderBottom:"1px solid #F3F4F6" }}>
            <h2 style={{ margin:0, fontSize:15, fontWeight:700, color:"#111827" }}>Recent Activity</h2>
          </div>
          {ESCALATION_LOGS.map((log, i) => {
            const patient = PATIENTS.find(p=>p.id===log.patientId);
            return (
              <div key={log.id} className="alert-row"
                style={{ display:"flex", alignItems:"center", gap:16, padding:"15px 22px",
                  borderBottom: i<ESCALATION_LOGS.length-1?"1px solid #F9FAFB":"none",
                  background: log.status==="failed"?"#FFFBEB":"#fff",
                  animation:`fadeUp 0.3s ease-out ${i*50}ms both` }}>
                {/* Type */}
                <div style={{ minWidth:120 }}><TypeBadge type={log.type} /></div>
                {/* Patient */}
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                    {patient && (
                      <Link href={"/patients/"+patient.id} style={{ fontSize:13, fontWeight:700,
                        color:"#111827", textDecoration:"none" }}>{patient.name}</Link>
                    )}
                    {patient && (
                      <span style={{ padding:"1px 7px", borderRadius:4, fontSize:10, fontWeight:700,
                        background: patient.riskLevel==="high"?"#FEE2E2":patient.riskLevel==="medium"?"#FEF3C7":"#D1FAE5",
                        color: patient.riskLevel==="high"?"#DC2626":patient.riskLevel==="medium"?"#D97706":"#059669" }}>
                        {patient.riskLevel.toUpperCase()}
                      </span>
                    )}
                  </div>
                  <p style={{ margin:"2px 0 0", fontSize:12, color:"#6B7280", lineHeight:1.5 }}>{log.note}</p>
                </div>
                {/* Status + time */}
                <div style={{ textAlign:"right", flexShrink:0 }}>
                  <StatusDot status={log.status} />
                  <p style={{ margin:"3px 0 0", fontSize:11, color:"#9CA3AF" }}>{timeAgo(log.sentAt)}</p>
                </div>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
