"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  getPatientById,
  updatePatient,
  getMedsByPatient,
  deleteMedication,
  deletePatient,
  getCommunications,
} from "@/lib/storage";
import type { Patient, Medication, CommunicationLog } from "@/types";
import {
  SendSmsModal,
  CallCaregiverModal,
  CallPatientMedCheckModal,
  LastSmsNote,
} from "../components/CommunicationModals";

function MedCard({ med, onDelete, delay }: { med: Medication; onDelete: () => void; delay: number }) {
  const [hov, setHov] = useState(false);
  return (
    <div
      style={{
        background: "#fff", border: "1.5px solid #E5E7EB", borderRadius: 13,
        padding: "16px 18px", display: "flex", gap: 14, alignItems: "flex-start",
        transition: "all 0.18s", animation: `fadeUp 0.3s ease-out ${delay}ms both`,
        borderLeft: "4px solid #0D9488",
        boxShadow: hov ? "0 4px 14px rgba(13,148,136,0.1)" : "0 1px 3px rgba(0,0,0,0.04)",
      }}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
    >
      <div style={{
        width: 38, height: 38, borderRadius: 10, background: "#CCFBF1",
        display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
      }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0D9488" strokeWidth="2">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
        </svg>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <p style={{ margin: "0 0 3px", fontSize: 15, fontWeight: 700, color: "#111827" }}>{med.name}</p>
          <button
            onClick={onDelete}
            title="Delete medication"
            style={{
              width: 28, height: 28, borderRadius: 7, border: "1px solid #FEE2E2",
              background: "#FFF5F5", cursor: "pointer", display: "flex", alignItems: "center",
              justifyContent: "center", flexShrink: 0, marginLeft: 8, transition: "all 0.15s",
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2.5">
              <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
            </svg>
          </button>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {(med.dosage || med.unit) && (
            <span style={{
              padding: "2px 9px", borderRadius: 6, background: "#F0FDF4",
              color: "#059669", fontSize: 12, fontWeight: 600,
            }}>
              {med.dosage} {med.unit}
            </span>
          )}
          <span style={{
            padding: "2px 9px", borderRadius: 6, background: "#EFF6FF",
            color: "#2563EB", fontSize: 12, fontWeight: 600,
          }}>
            {med.schedule}
          </span>
        </div>
        {med.notes && <p style={{ margin: "6px 0 0", fontSize: 12, color: "#6B7280", lineHeight: 1.5 }}>{med.notes}</p>}
        <p style={{ margin: "6px 0 0", fontSize: 11, color: "#9CA3AF" }}>
          Added {new Date(med.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
        </p>
      </div>
    </div>
  );
}

export default function PatientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [patient, setPatient] = useState<Patient | null | undefined>(undefined);
  const [meds, setMeds] = useState<Medication[]>([]);
  const [toast, setToast] = useState<string | null>(null);

  // Modals state
  const [showEditModal, setShowEditModal] = useState(false);
  const [showSmsModal, setShowSmsModal] = useState(false);
  const [showCallModal, setShowCallModal] = useState(false);
  const [showMedCheckModal, setShowMedCheckModal] = useState(false);
  const [commLogs, setCommLogs] = useState<CommunicationLog[]>([]);

  // Edit patient fields
  const [editName, setEditName] = useState("");
  const [editAge, setEditAge] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editDiabetes, setEditDiabetes] = useState(false);
  const [editHypertension, setEditHypertension] = useState(false);
  const [editIsDeaf, setEditIsDeaf] = useState(false);

  // Medication check call status state
  const [latestMedCheck, setLatestMedCheck] = useState<any>(null);
  const [isCallingMedCheck, setIsCallingMedCheck] = useState(false);
  const [isPollingMedCheck, setIsPollingMedCheck] = useState(false);

  const fetchLatestMedCheck = useCallback(async () => {
    try {
      const res = await fetch(`/api/call-patient/responses?patientId=${encodeURIComponent(id)}`);
      const data = await res.json();
      if (data.success && data.latest) {
        setLatestMedCheck(data.latest);
        return data.latest;
      }
    } catch (e) {
      console.warn("Failed to fetch med check:", e);
    }
    return null;
  }, [id]);

  const handleSimulateReply = async (replyDigit: "1" | "2" | "3" | "4") => {
    if (!patient) return;
    try {
      const res = await fetch("/api/call-patient/reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId: patient.id,
          checkId: latestMedCheck?.id,
          reply: replyDigit,
          source: "manual_simulation",
        }),
      });
      const data = await res.json();
      if (data.success) {
        const labels: Record<string, string> = {
          "1": "1 (Taken) recorded & sent to Telegram bot!",
          "2": "2 (Not Taken) recorded & sent to Telegram bot!",
          "3": "3 (Skipped) recorded & sent to Telegram bot!",
          "4": "4 (Rescheduled) recorded & sent to Telegram bot!",
        };
        setToast(`Simulated: ${labels[replyDigit] || replyDigit}`);
        await fetchLatestMedCheck();
      }
    } catch (e: any) {
      alert("Simulation failed: " + e.message);
    }
  };

  const handleCallPatientMedCheck = async () => {
    if (!patient) return;
    setIsCallingMedCheck(true);
    try {
      const res = await fetch("/api/call-patient", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId: patient.id,
          patientName: patient.name,
          phone: patient.phone,
          isDeaf: Boolean(patient.isDeaf),
          telegramChatId: patient.telegramChatId,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setToast(
          patient.isDeaf
            ? `Medication check reminder sent to ${patient.name} via SMS & Telegram!`
            : `Calling ${patient.name}... Keypad check initiated!`
        );
        if (data.record) setLatestMedCheck(data.record);
        setIsPollingMedCheck(true);
        let count = 0;
        const interval = setInterval(async () => {
          count++;
          const rec = await fetchLatestMedCheck();
          if (rec && (rec.status === "completed" || rec.status === "no_response" || count > 10)) {
            clearInterval(interval);
            setIsPollingMedCheck(false);
          }
        }, 3000);
      } else {
        alert(data.error || "Failed to initiate call");
      }
    } catch (err: any) {
      alert(err?.message || "Failed to initiate call");
    } finally {
      setIsCallingMedCheck(false);
    }
  };

  useEffect(() => {
    fetchLatestMedCheck();
  }, [fetchLatestMedCheck]);

  const loadData = useCallback(() => {
    const p = getPatientById(id);
    setPatient(p ?? null);
    if (p) {
      setMeds(getMedsByPatient(id));
      setCommLogs(getCommunications(id));
      setEditName(p.name);
      setEditAge(p.age !== null && p.age !== undefined ? String(p.age) : "");
      setEditPhone(p.phone || "");
      setEditDiabetes(Boolean(p.hasDiabetes));
      setEditHypertension(Boolean(p.hasHypertension));
      setEditIsDeaf(Boolean(p.isDeaf));
    }
  }, [id]);

  useEffect(() => {
    loadData();
    const msg = sessionStorage.getItem("raksha_toast");
    if (msg) {
      setToast(msg);
      sessionStorage.removeItem("raksha_toast");
      setTimeout(() => setToast(null), 3000);
    }
  }, [loadData]);

  function handleDeleteMed(medId: string, medName: string) {
    if (!confirm(`Delete medication "${medName}"?`)) return;
    deleteMedication(medId);
    setMeds(getMedsByPatient(id));
    setToast(`${medName} deleted.`);
    setTimeout(() => setToast(null), 3000);
  }

  function handleDeletePatient() {
    if (!patient) return;
    if (!confirm(`Delete patient "${patient.name}" and all their medications?`)) return;
    deletePatient(id);
    sessionStorage.setItem("raksha_toast", `${patient.name} deleted.`);
    router.push("/patients");
  }

  function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editName.trim()) return;
    const updated = updatePatient(id, {
      name: editName.trim(),
      age: editAge ? Number(editAge) : null,
      phone: editPhone.trim(),
      hasDiabetes: editDiabetes,
      hasHypertension: editHypertension,
      isDeaf: editIsDeaf,
    });
    if (updated) {
      setPatient(updated);
      setShowEditModal(false);
      setToast("Patient details updated.");
      setTimeout(() => setToast(null), 3000);
    }
  }

  if (patient === undefined) {
    return (
      <div style={{ minHeight: "100vh", background: "#F9FAFB", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: 48, height: 48, borderRadius: 12, background: "#F3F4F6", animation: "pulse 1.5s ease-in-out infinite" }} />
      </div>
    );
  }

  if (patient === null) {
    return (
      <div style={{
        minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
        flexDirection: "column", gap: 12, fontFamily: "Inter,sans-serif", background: "#F9FAFB"
      }}>
        <p style={{ fontSize: 18, fontWeight: 700, color: "#374151" }}>Patient not found</p>
        <Link href="/patients" style={{ color: "#0D9488", fontSize: 14, fontWeight: 600 }}>Back to Patients</Link>
      </div>
    );
  }

  const initials = patient.name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();

  const modalOverlayStyle: React.CSSProperties = {
    position: "fixed", inset: 0, background: "rgba(17,24,39,0.55)", backdropFilter: "blur(3px)",
    zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
  };
  const modalBoxStyle: React.CSSProperties = {
    background: "#fff", borderRadius: 18, width: "100%", maxWidth: 440,
    boxShadow: "0 20px 40px rgba(0,0,0,0.18)", padding: "28px 26px", animation: "fadeUp 0.25s ease-out",
  };
  const inpStyle: React.CSSProperties = {
    width: "100%", padding: "10px 14px", borderRadius: 9, border: "1.5px solid #E5E7EB",
    fontSize: 14, outline: "none", color: "#111827", background: "#fff", boxSizing: "border-box",
  };
  const lblStyle: React.CSSProperties = {
    display: "block", fontSize: 11, fontWeight: 700, color: "#4B5563",
    textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6,
  };

  return (
    <div style={{ minHeight: "100vh", background: "#F9FAFB", fontFamily: "Inter,ui-sans-serif,system-ui,sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        * { box-sizing:border-box; }
        @keyframes fadeUp { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        .fade-up { animation:fadeUp 0.35s ease-out both; }
        input:focus, textarea:focus, select:focus { border-color:#0D9488 !important; box-shadow:0 0 0 3px rgba(13,148,136,0.1); }
      `}</style>

      {/* Toast Notification */}
      {toast && (
        <div style={{
          position: "fixed", bottom: 28, right: 28, zIndex: 99999,
          background: "#111827", color: "#fff", padding: "12px 20px", borderRadius: 12,
          fontSize: 13, fontWeight: 600, boxShadow: "0 8px 24px rgba(0,0,0,0.2)",
          animation: "fadeUp 0.25s ease-out",
        }}>
          ✓ {toast}
        </div>
      )}

      {/* Top Header */}
      <header style={{
        background: "#fff", borderBottom: "1px solid #E5E7EB", padding: "0 32px",
        height: 60, display: "flex", alignItems: "center", gap: 14,
        position: "sticky", top: 0, zIndex: 30, boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
      }}>
        <Link href="/patients" style={{
          width: 34, height: 34, borderRadius: 9, border: "1px solid #E5E7EB",
          background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none",
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
        </Link>
        <div style={{ width: 1, height: 20, background: "#E5E7EB" }} />
        <Link href="/patients" style={{ fontSize: 13, color: "#6B7280", textDecoration: "none" }}>Patients</Link>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#D1D5DB" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
        <span style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>{patient.name}</span>
      </header>

      {/* Patient Hero Banner */}
      <div style={{ background: "#fff", borderBottom: "1px solid #E5E7EB", padding: "24px 32px" }}>
        <div style={{
          maxWidth: 900, margin: "0 auto", display: "flex", alignItems: "center",
          justifyContent: "space-between", gap: 20, flexWrap: "wrap",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{
              width: 56, height: 56, borderRadius: 14, background: "#CCFBF1",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 18, fontWeight: 800, color: "#0D9488",
            }}>{initials}</div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#111827", letterSpacing: "-0.02em" }}>
                  {patient.name}
                </h1>
                {patient.hasDiabetes && (
                  <span style={{
                    padding: "3px 9px", borderRadius: 6, background: "#EFF6FF",
                    color: "#2563EB", fontSize: 11, fontWeight: 700, border: "1px solid #DBEAFE",
                  }}>
                    🩺 Diabetes
                  </span>
                )}
                {patient.hasHypertension && (
                  <span style={{
                    padding: "3px 9px", borderRadius: 6, background: "#FEF2F2",
                    color: "#DC2626", fontSize: 11, fontWeight: 700, border: "1px solid #FEE2E2",
                  }}>
                    💓 Hypertension
                  </span>
                )}
                {patient.isDeaf && (
                  <span style={{
                    padding: "3px 9px", borderRadius: 6, background: "#EEF2FF",
                    color: "#4F46E5", fontSize: 11, fontWeight: 700, border: "1px solid #C7D2FE",
                  }}>
                    🧏 Deaf (SMS &amp; Telegram)
                  </span>
                )}
              </div>

              <p style={{ margin: "4px 0 0", fontSize: 13, color: "#6B7280" }}>
                {patient.age ? `${patient.age} years old` : "Age not set"}
                {patient.phone && ` • ${patient.phone}`}
                {` • Enrolled ${new Date(patient.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}`}
              </p>

              {patient.conditions.length > 0 && (
                <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                  {patient.conditions.map(c => (
                    <span key={c} style={{
                      padding: "2px 8px", borderRadius: 5, background: "#F3F4F6",
                      fontSize: 11, fontWeight: 600, color: "#374151",
                    }}>{c}</span>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <button
              onClick={() => setShowSmsModal(true)}
              style={{
                display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 15px",
                borderRadius: 10, background: "#00C896", color: "#fff", border: "none",
                fontSize: 13, fontWeight: 700, cursor: "pointer",
                boxShadow: "0 2px 8px rgba(0,200,150,0.25)",
              }}
            >
              💬 Send SMS
            </button>
            <button
              onClick={() => setShowCallModal(true)}
              style={{
                display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 15px",
                borderRadius: 10, background: "#0F172A", color: "#fff", border: "none",
                fontSize: 13, fontWeight: 700, cursor: "pointer",
              }}
            >
              📞 Call Caregiver
            </button>
            <button
              onClick={() => setShowMedCheckModal(true)}
              style={{
                display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 15px",
                borderRadius: 10,
                background: patient.isDeaf ? "#4F46E5" : "#2563EB",
                color: "#fff", border: "none",
                fontSize: 13, fontWeight: 700, cursor: "pointer",
                boxShadow: patient.isDeaf ? "0 2px 8px rgba(79,70,229,0.25)" : "0 2px 8px rgba(37,99,235,0.25)",
              }}
              title={patient.isDeaf ? "Send interactive reminder message via SMS & Telegram (Reply 1 = Taken, 2 = Not Taken)" : "Place interactive voice call to patient (Press 1 = Taken, Press 2 = Not Taken)"}
            >
              {patient.isDeaf ? "📱 Med Check Message" : "📞 Med Check Call"}
            </button>
            <Link
              href={"/patients/add-medication?patientId=" + patient.id}
              style={{
                display: "inline-flex", alignItems: "center", gap: 7, padding: "9px 16px",
                borderRadius: 10, background: "#0D9488", color: "#fff", textDecoration: "none",
                fontSize: 13, fontWeight: 700,
              }}
            >
              + Add Medication
            </Link>
            <button
              onClick={() => setShowEditModal(true)}
              style={{
                padding: "9px 14px", borderRadius: 10, border: "1.5px solid #E5E7EB",
                background: "#fff", color: "#374151", fontSize: 13, fontWeight: 700, cursor: "pointer",
              }}
            >
              Edit Patient
            </button>
            <button
              onClick={handleDeletePatient}
              style={{
                padding: "9px 14px", borderRadius: 10, border: "1.5px solid #FEE2E2",
                background: "#fff", color: "#DC2626", fontSize: 13, fontWeight: 700, cursor: "pointer",
              }}
            >
              Delete
            </button>
          </div>
        </div>
      </div>

      <main style={{ maxWidth: 900, margin: "0 auto", padding: "28px 24px 64px" }}>
        {/* Quick Stat Tiles */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12, marginBottom: 24 }} className="fade-up">
          <div style={{
            padding: "14px 18px", borderRadius: 12, background: "#fff",
            border: "1px solid #E5E7EB", boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
          }}>
            <p style={{ margin: "0 0 2px", fontSize: 11, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.06em" }}>Prescribed Medications</p>
            <p style={{ margin: 0, fontSize: 24, fontWeight: 800, color: "#111827" }}>{meds.length}</p>
          </div>
          <div style={{
            padding: "14px 18px", borderRadius: 12, background: "#fff",
            border: "1px solid #E5E7EB", boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
          }}>
            <p style={{ margin: "0 0 2px", fontSize: 11, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.06em" }}>Patient Since</p>
            <p style={{ margin: 0, fontSize: 20, fontWeight: 800, color: "#2563EB" }}>
              {new Date(patient.createdAt).toLocaleDateString("en-IN", { month: "short", year: "numeric" })}
            </p>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════════════════════
            MEDICATION CHECK CALL STATUS SECTION
        ══════════════════════════════════════════════════════════════════════════ */}
        <section style={{ marginBottom: 36 }} className="fade-up">
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            marginBottom: 14, flexWrap: "wrap", gap: 12,
          }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 18 }}>{patient.isDeaf ? "💬" : "📞"}</span>
                <h2 style={{ margin: "0 0 2px", fontSize: 18, fontWeight: 800, color: "#111827", letterSpacing: "-0.01em" }}>
                  {patient.isDeaf ? "Medication Check via Message" : "Interactive Medication Check Call"}
                </h2>
                {patient.isDeaf && (
                  <span style={{
                    display: "inline-flex", alignItems: "center", gap: 4,
                    padding: "2px 8px", borderRadius: 999, background: "#EDE9FE", color: "#6D28D9",
                    fontSize: 11, fontWeight: 700,
                  }}>
                    🧏 Deaf Mode
                  </span>
                )}
                {isPollingMedCheck && (
                  <span style={{
                    display: "inline-flex", alignItems: "center", gap: 4,
                    padding: "2px 8px", borderRadius: 999, background: "#FEF3C7", color: "#B45309",
                    fontSize: 11, fontWeight: 700,
                  }}>
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#F59E0B", animation: "pulse 1s infinite" }} />
                    {patient.isDeaf ? "Message Sent..." : "Live Call In Progress..."}
                  </span>
                )}
              </div>
              <p style={{ margin: 0, fontSize: 12, color: "#6B7280" }}>
                {patient.isDeaf
                  ? "Sends SMS + Telegram message asking if medicine was taken — Reply 1 (Taken) / 2 (Not Taken)"
                  : "Twilio IVR automated phone call asks elderly patient if medicine was taken: Press 1 (Yes) / Press 2 (No)"}
              </p>
            </div>

            <button
              onClick={handleCallPatientMedCheck}
              disabled={isCallingMedCheck}
              style={{
                display: "inline-flex", alignItems: "center", gap: 7, padding: "9px 16px",
                borderRadius: 10,
                background: isCallingMedCheck ? "#94A3B8" : patient.isDeaf ? "#7C3AED" : "#2563EB",
                color: "#fff", border: "none",
                fontSize: 13, fontWeight: 700, cursor: isCallingMedCheck ? "not-allowed" : "pointer",
                boxShadow: patient.isDeaf ? "0 2px 8px rgba(124,58,237,0.25)" : "0 2px 8px rgba(37,99,235,0.2)",
              }}
            >
              {isCallingMedCheck
                ? (patient.isDeaf ? "Sending..." : "Dialing...")
                : (patient.isDeaf ? "💬 Send Message Now" : "⚡ Call Patient Now")}
            </button>
          </div>

          {latestMedCheck ? (
            <div style={{
              background: "#fff",
              border: "1.5px solid #E2E8F0",
              borderRadius: 16,
              padding: "20px 22px",
              boxShadow: "0 2px 6px rgba(0,0,0,0.03)",
              display: "flex",
              flexDirection: "column",
              gap: 14,
            }}>
              {(() => {
                const digitsVal = latestMedCheck.digits || latestMedCheck.digits_pressed;
                const isTaken = latestMedCheck.response === "Taken" || latestMedCheck.response === "taken" || digitsVal === "1";
                const isNotTaken = latestMedCheck.response === "Not Taken" || latestMedCheck.response === "not_taken" || digitsVal === "2";
                const isSkipped = latestMedCheck.response === "Skipped" || latestMedCheck.response === "skipped" || digitsVal === "3";
                const isRescheduled = latestMedCheck.response === "Rescheduled" || latestMedCheck.response === "rescheduled" || digitsVal === "4";
                const isPending = latestMedCheck.response === "Pending" || latestMedCheck.status === "calling" || latestMedCheck.status === "initiated" || latestMedCheck.status === "in_progress";
                const isNoResponse = latestMedCheck.status === "no_response" || latestMedCheck.response === "No Response";

                return (
                  <>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                        <span style={{
                          display: "inline-flex", alignItems: "center", gap: 6,
                          padding: "4px 12px", borderRadius: 999, fontSize: 12, fontWeight: 800,
                          background: isTaken
                            ? "#ECFDF5"
                            : isNotTaken
                            ? "#FEF2F2"
                            : isSkipped
                            ? "#F1F5F9"
                            : isRescheduled
                            ? "#FEF3C7"
                            : isNoResponse
                            ? "#FFFBEB"
                            : "#EFF6FF",
                          color: isTaken
                            ? "#059669"
                            : isNotTaken
                            ? "#DC2626"
                            : isSkipped
                            ? "#475569"
                            : isRescheduled
                            ? "#B45309"
                            : isNoResponse
                            ? "#D97706"
                            : "#2563EB",
                          border: "1px solid currentColor",
                        }}>
                          {isTaken && (patient.isDeaf ? "✓ Medicine Taken (SMS/TG Reply 1)" : "✓ Medicine Taken (Pressed 1)")}
                          {isNotTaken && (patient.isDeaf ? "⚠ Medicine NOT Taken (SMS/TG Reply 2)" : "⚠ Medicine NOT Taken (Pressed 2)")}
                          {isSkipped && "⏭️ Dose Skipped (Reply 3)"}
                          {isRescheduled && "⏰ Rescheduled / Snoozed (Reply 4)"}
                          {isPending && (patient.isDeaf ? "💬 Reminder Sent • Awaiting Response..." : "📞 Outbound Call Placed • Awaiting 1 or 2...")}
                          {isNoResponse && "⏱ No Answer / Timed Out"}
                          {!isTaken && !isNotTaken && !isSkipped && !isRescheduled && !isPending && !isNoResponse && (latestMedCheck.response || latestMedCheck.status)}
                        </span>

                        {latestMedCheck.isDeaf && (
                          <span style={{
                            padding: "3px 8px", borderRadius: 6, background: "#EDE9FE",
                            color: "#6D28D9", fontSize: 11, fontWeight: 700, border: "1px solid #DDD6FE",
                          }}>
                            🧏 SMS &amp; Telegram Channel
                          </span>
                        )}

                        <span style={{ fontSize: 12, color: "#64748B" }}>
                          Last Checked: {new Date(latestMedCheck.timestamp || latestMedCheck.called_at || latestMedCheck.createdAt || latestMedCheck.created_at || Date.now()).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <button
                          onClick={fetchLatestMedCheck}
                          style={{
                            padding: "4px 10px", borderRadius: 6, border: "1px solid #CBD5E1",
                            background: "#F8FAFC", fontSize: 11, fontWeight: 600, color: "#475569", cursor: "pointer",
                          }}
                        >
                          🔄 Refresh Status
                        </button>
                      </div>
                    </div>

                    <div style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                      gap: 12,
                      padding: "12px 14px",
                      borderRadius: 10,
                      background: "#F8FAFC",
                      border: "1px solid #E2E8F0",
                      fontSize: 12,
                    }}>
                      <div>
                        <span style={{ color: "#64748B", display: "block", fontSize: 10, fontWeight: 700, textTransform: "uppercase" }}>Phone Number</span>
                        <strong style={{ color: "#0F172A" }}>{latestMedCheck.phone || latestMedCheck.phone_number || patient.phone || "—"}</strong>
                      </div>
                      <div>
                        <span style={{ color: "#64748B", display: "block", fontSize: 10, fontWeight: 700, textTransform: "uppercase" }}>User Response</span>
                        <strong style={{
                          color: isTaken ? "#059669" : isNotTaken ? "#DC2626" : isSkipped ? "#475569" : isRescheduled ? "#B45309" : "#0F172A",
                          fontSize: 13,
                        }}>
                          {digitsVal ? `Key [${digitsVal}]` : (latestMedCheck.response || "Awaiting reply...")}
                        </strong>
                      </div>
                      <div>
                        <span style={{ color: "#64748B", display: "block", fontSize: 10, fontWeight: 700, textTransform: "uppercase" }}>Outcome</span>
                        <strong style={{ color: isTaken ? "#059669" : isNotTaken ? "#DC2626" : isSkipped ? "#475569" : isRescheduled ? "#B45309" : "#0F172A" }}>
                          {isTaken
                            ? "Success — Taken"
                            : isNotTaken
                            ? "Caregiver Alert Sent"
                            : isSkipped
                            ? "Dose Skipped"
                            : isRescheduled
                            ? "Rescheduled / Snoozed"
                            : latestMedCheck.status}
                        </strong>
                      </div>
                      <div>
                        <span style={{ color: "#64748B", display: "block", fontSize: 10, fontWeight: 700, textTransform: "uppercase" }}>Channel</span>
                        <span style={{ color: "#64748B", fontSize: 12, fontWeight: 600 }}>
                          {latestMedCheck.isDeaf ? "SMS + Telegram 🤖" : "Twilio Voice Call 📞"}
                        </span>
                      </div>
                    </div>

                    {/* Simulation controls for instant testing */}
                    <div style={{
                      background: "#F0FDFA",
                      border: "1px dashed #99F6E4",
                      borderRadius: 10,
                      padding: "10px 12px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      flexWrap: "wrap",
                      gap: 8,
                    }}>
                      <div>
                        <span style={{ fontSize: 11, fontWeight: 700, color: "#0F766E", display: "block" }}>
                          🧪 Test Patient Reply Simulator (Broadcasts live to Telegram Bot):
                        </span>
                        <span style={{ fontSize: 11, color: "#115E59" }}>
                          Test incoming patient response — taken, not taken, skip, or reschedule.
                        </span>
                      </div>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        <button
                          onClick={() => handleSimulateReply("1")}
                          style={{
                            padding: "6px 10px",
                            borderRadius: 7,
                            border: "1.5px solid #A7F3D0",
                            background: "#ECFDF5",
                            color: "#065F46",
                            fontSize: 11,
                            fontWeight: 700,
                            cursor: "pointer",
                          }}
                        >
                          1️⃣ Taken ✅
                        </button>
                        <button
                          onClick={() => handleSimulateReply("2")}
                          style={{
                            padding: "6px 10px",
                            borderRadius: 7,
                            border: "1.5px solid #FECACA",
                            background: "#FEF2F2",
                            color: "#991B1B",
                            fontSize: 11,
                            fontWeight: 700,
                            cursor: "pointer",
                          }}
                        >
                          2️⃣ Not Taken ❌
                        </button>
                        <button
                          onClick={() => handleSimulateReply("3")}
                          style={{
                            padding: "6px 10px",
                            borderRadius: 7,
                            border: "1.5px solid #CBD5E1",
                            background: "#F1F5F9",
                            color: "#334155",
                            fontSize: 11,
                            fontWeight: 700,
                            cursor: "pointer",
                          }}
                        >
                          3️⃣ Skip ⏭️
                        </button>
                        <button
                          onClick={() => handleSimulateReply("4")}
                          style={{
                            padding: "6px 10px",
                            borderRadius: 7,
                            border: "1.5px solid #FDE68A",
                            background: "#FEF3C7",
                            color: "#92400E",
                            fontSize: 11,
                            fontWeight: 700,
                            cursor: "pointer",
                          }}
                        >
                          4️⃣ Reschedule ⏰
                        </button>
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>
          ) : (
            <div style={{
              background: "#F8FAFC",
              border: "1px dashed #CBD5E1",
              borderRadius: 12,
              padding: "16px",
              textAlign: "center",
              color: "#64748B",
              fontSize: 13,
            }}>
              No medication check {patient.isDeaf ? "message" : "call"} has been made for {patient.name} yet today. Click &quot;{patient.isDeaf ? "Send Message Now" : "Call Patient Now"}&quot; to test the reply 1 / reply 2 flow.
            </div>
          )}
        </section>

        {/* ══════════════════════════════════════════════════════════════════════════
            MEDICATIONS SECTION
        ══════════════════════════════════════════════════════════════════════════ */}
        <section style={{ marginBottom: 36 }} className="fade-up">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "#111827", letterSpacing: "-0.01em" }}>
              Medications <span style={{ fontSize: 13, color: "#9CA3AF", fontWeight: 500 }}>({meds.length})</span>
            </h2>
            <Link
              href={"/patients/add-medication?patientId=" + patient.id}
              style={{ fontSize: 13, color: "#0D9488", fontWeight: 700, textDecoration: "none" }}
            >
              + Add another medication
            </Link>
          </div>

          {meds.length === 0 ? (
            <div style={{
              textAlign: "center", padding: "52px 24px", background: "#fff",
              border: "1.5px dashed #E5E7EB", borderRadius: 16,
            }}>
              <div style={{
                width: 52, height: 52, borderRadius: "50%", background: "#F0FDF4",
                display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px",
              }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                </svg>
              </div>
              <p style={{ fontSize: 15, fontWeight: 700, color: "#111827", margin: "0 0 5px" }}>No medications yet</p>
              <p style={{ fontSize: 13, color: "#9CA3AF", margin: "0 0 18px" }}>Add the first medication for {patient.name}.</p>
              <Link
                href={"/patients/add-medication?patientId=" + patient.id}
                style={{
                  padding: "10px 20px", borderRadius: 9, background: "#0D9488",
                  color: "#fff", textDecoration: "none", fontSize: 14, fontWeight: 700,
                }}
              >
                + Add Medication
              </Link>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {meds.map((m, i) => (
                <MedCard
                  key={m.id}
                  med={m}
                  delay={i * 50}
                  onDelete={() => handleDeleteMed(m.id, m.name)}
                />
              ))}
            </div>
          )}
        </section>

        {/* ══════════════════════════════════════════════════════════════════════════
            CAREGIVERS & FAMILY CONTACTS SECTION
        ══════════════════════════════════════════════════════════════════════════ */}
        <section style={{ marginBottom: 36 }} className="fade-up">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <div>
              <h2 style={{ margin: "0 0 2px", fontSize: 18, fontWeight: 800, color: "#111827" }}>
                Caregiver & Emergency Contacts
              </h2>
              <p style={{ margin: 0, fontSize: 12, color: "#6B7280" }}>
                Primary family member or clinician contacts for SMS check-ins and emergency calls
              </p>
            </div>
            <LastSmsNote patientId={patient.id} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14 }}>
            {patient.caregivers && patient.caregivers.length > 0 ? (
              patient.caregivers.map((cg, idx) => (
                <div
                  key={idx}
                  style={{
                    background: "#fff",
                    border: "1.5px solid #E5E7EB",
                    borderRadius: 14,
                    padding: "18px 20px",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
                  }}
                >
                  <div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 18 }}>👤</span>
                        <span style={{ fontSize: 15, fontWeight: 800, color: "#111827" }}>{cg.name}</span>
                      </div>
                      {cg.isPrimary && (
                        <span
                          style={{
                            padding: "2px 8px",
                            borderRadius: 6,
                            background: "#ECFDF5",
                            color: "#065F46",
                            fontSize: 11,
                            fontWeight: 800,
                            border: "1px solid #A7F3D0",
                          }}
                        >
                          PRIMARY
                        </span>
                      )}
                    </div>
                    <p style={{ margin: "0 0 4px", fontSize: 13, color: "#6B7280" }}>
                      Relation: <strong style={{ color: "#374151" }}>{cg.relation}</strong>
                    </p>
                    <p style={{ margin: 0, fontSize: 14, color: "#0284C7", fontWeight: 700 }}>
                      📞 {cg.phone}
                    </p>
                  </div>

                  <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                    <button
                      onClick={() => setShowSmsModal(true)}
                      style={{
                        flex: 1,
                        padding: "7px 12px",
                        borderRadius: 8,
                        background: "#00C896",
                        color: "#fff",
                        border: "none",
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      💬 SMS
                    </button>
                    <button
                      onClick={() => setShowCallModal(true)}
                      style={{
                        flex: 1,
                        padding: "7px 12px",
                        borderRadius: 8,
                        background: "#0F172A",
                        color: "#fff",
                        border: "none",
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      📞 Call
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div
                style={{
                  background: "#fff",
                  border: "1.5px dashed #E5E7EB",
                  borderRadius: 14,
                  padding: "20px",
                  color: "#6B7280",
                  fontSize: 13,
                }}
              >
                No specific caregivers listed. Using patient primary phone ({patient.phone}).
              </div>
            )}
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════════════════════
            RECENT COMMUNICATION LOGS SECTION
        ══════════════════════════════════════════════════════════════════════════ */}
        <section style={{ marginBottom: 36 }} className="fade-up">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <div>
              <h2 style={{ margin: "0 0 2px", fontSize: 18, fontWeight: 800, color: "#111827" }}>
                Communication & Outreach History
              </h2>
              <p style={{ margin: 0, fontSize: 12, color: "#6B7280" }}>
                Audit trail of automated and manual Twilio SMS messages and voice calls
              </p>
            </div>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#64748B" }}>
              {commLogs.length} Logged
            </span>
          </div>

          {commLogs.length === 0 ? (
            <div
              style={{
                background: "#fff",
                border: "1.5px dashed #E5E7EB",
                borderRadius: 14,
                padding: "24px",
                textAlign: "center",
                color: "#9CA3AF",
                fontSize: 13,
              }}
            >
              No SMS or voice calls sent to this caregiver yet. Click &quot;Send SMS&quot; above to initiate outreach.
            </div>
          ) : (
            <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 14, overflow: "hidden" }}>
              {commLogs.map((log, index) => (
                <div
                  key={log.id || index}
                  style={{
                    padding: "14px 18px",
                    borderBottom: index < commLogs.length - 1 ? "1px solid #F3F4F6" : "none",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 14,
                    flexWrap: "wrap",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{ fontSize: 18 }}>{log.type === "sms" ? "💬" : "📞"}</span>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 14, fontWeight: 800, color: "#111827" }}>
                          {log.type === "sms" ? "SMS Delivered" : "Voice Call Initiated"}
                        </span>
                        <span
                          style={{
                            padding: "2px 7px",
                            borderRadius: 6,
                            fontSize: 11,
                            fontWeight: 700,
                            background: log.status === "sent" ? "#ECFDF5" : "#FEF2F2",
                            color: log.status === "sent" ? "#065F46" : "#991B1B",
                          }}
                        >
                          {log.status === "sent" ? "Delivered" : "Failed"}
                        </span>
                      </div>
                      <p style={{ margin: "3px 0 0", fontSize: 12, color: "#6B7280" }}>
                        To: <strong>{log.recipientName}</strong> ({log.to})
                        {log.message && ` • "${log.message.slice(0, 75)}${log.message.length > 75 ? "..." : ""}"`}
                      </p>
                    </div>
                  </div>

                  <div style={{ textAlign: "right" }}>
                    <span style={{ fontSize: 12, color: "#9CA3AF" }}>
                      {new Date(log.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} •{" "}
                      {new Date(log.timestamp).toLocaleDateString([], { month: "short", day: "numeric" })}
                    </span>
                    {log.sid && (
                      <div style={{ fontSize: 10, color: "#CBD5E1", fontFamily: "monospace" }}>
                        SID: {log.sid.slice(0, 16)}...
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      {/* ══════════════════════════════════════════════════════════════════════════
          MODAL: EDIT PATIENT
      ══════════════════════════════════════════════════════════════════════════ */}
      {showEditModal && (
        <div style={modalOverlayStyle} onClick={() => setShowEditModal(false)}>
          <div style={modalBoxStyle} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "#111827" }}>Edit Patient Details</h3>
              <button
                onClick={() => setShowEditModal(false)}
                style={{ border: "none", background: "none", fontSize: 18, cursor: "pointer", color: "#9CA3AF" }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEdit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={lblStyle}>Full Name *</label>
                <input
                  required
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  style={inpStyle}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={lblStyle}>Age</label>
                  <input
                    type="number"
                    min="0"
                    max="130"
                    value={editAge}
                    onChange={e => setEditAge(e.target.value)}
                    style={inpStyle}
                  />
                </div>
                <div>
                  <label style={lblStyle}>Phone</label>
                  <input
                    value={editPhone}
                    onChange={e => setEditPhone(e.target.value)}
                    style={inpStyle}
                  />
                </div>
              </div>

              <div style={{ background: "#F0FDFA", border: "1.5px solid #99F6E4", borderRadius: 10, padding: "12px 14px", marginTop: 4 }}>
                <p style={{ ...lblStyle, color: "#0D9488", marginBottom: 8 }}>Condition Flags</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, fontWeight: 600, color: "#111827" }}>
                    <input
                      type="checkbox"
                      checked={editDiabetes}
                      onChange={e => setEditDiabetes(e.target.checked)}
                      style={{ width: 16, height: 16, accentColor: "#0D9488" }}
                    />
                    Has Diabetes
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, fontWeight: 600, color: "#111827" }}>
                    <input
                      type="checkbox"
                      checked={editHypertension}
                      onChange={e => setEditHypertension(e.target.checked)}
                      style={{ width: 16, height: 16, accentColor: "#0D9488" }}
                    />
                    Has Hypertension
                  </label>
                </div>
              </div>

              {/* Hearing Accessibility */}
              <div style={{ background: "#EEF2FF", border: editIsDeaf ? "1.5px solid #6366F1" : "1.5px solid #C7D2FE", borderRadius: 10, padding: "12px 14px", marginTop: 4 }}>
                <p style={{ ...lblStyle, color: "#4F46E5", marginBottom: 8 }}>Hearing Accessibility</p>
                <label style={{ display: "flex", alignItems: "flex-start", gap: 8, cursor: "pointer", fontSize: 13, fontWeight: 600, color: "#111827" }}>
                  <input
                    type="checkbox"
                    checked={editIsDeaf}
                    onChange={e => setEditIsDeaf(e.target.checked)}
                    style={{ width: 16, height: 16, accentColor: "#4F46E5", marginTop: 2 }}
                  />
                  <div>
                    <span style={{ display: "block" }}>Patient is Deaf / Cannot Receive Calls 🧏</span>
                    <span style={{ fontSize: 11, color: "#6B7280", fontWeight: 400, display: "block", marginTop: 2 }}>
                      Switches medication checks to SMS & Telegram (Reply 1 = Taken, 2 = Not Taken)
                    </span>
                  </div>
                </label>
              </div>

              <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  style={{
                    flex: 1, padding: "10px", borderRadius: 9, border: "1.5px solid #E5E7EB",
                    background: "#fff", color: "#6B7280", fontWeight: 700, cursor: "pointer"
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!editName.trim()}
                  style={{
                    flex: 2, padding: "10px", borderRadius: 9, border: "none",
                    background: editName.trim() ? "#0D9488" : "#D1D5DB", color: "#fff",
                    fontWeight: 700, cursor: editName.trim() ? "pointer" : "not-allowed"
                  }}
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Twilio SMS & Call Modals */}
      <SendSmsModal
        isOpen={showSmsModal}
        onClose={() => {
          setShowSmsModal(false);
          setCommLogs(getCommunications(id));
        }}
        patient={patient}
        onSuccess={(msg) => {
          setToast(msg);
          setCommLogs(getCommunications(id));
        }}
      />
      <CallCaregiverModal
        isOpen={showCallModal}
        onClose={() => {
          setShowCallModal(false);
          setCommLogs(getCommunications(id));
        }}
        patient={patient}
        onSuccess={(msg) => {
          setToast(msg);
          setCommLogs(getCommunications(id));
        }}
      />
      <CallPatientMedCheckModal
        isOpen={showMedCheckModal}
        onClose={() => {
          setShowMedCheckModal(false);
          fetchLatestMedCheck();
        }}
        patient={patient}
        onSuccess={(msg) => {
          setToast(msg);
          fetchLatestMedCheck();
        }}
        onPatientUpdated={(updated) => {
          setPatient(updated);
        }}
      />
    </div>
  );
}
