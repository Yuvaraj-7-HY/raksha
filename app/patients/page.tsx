"use client";

import { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import {
  getPatients,
  deletePatient,
  getMedications,
  deleteMedication,
  getPrimaryCaregiver,
} from "@/lib/storage";
import type { Patient, Medication } from "@/types";
import {
  SendSmsModal,
  CallCaregiverModal,
  LastSmsNote,
} from "./components/CommunicationModals";

function EmptyState({ tab }: { tab: "patients" | "medications" }) {
  if (tab === "medications") {
    return (
      <div style={{ textAlign: "center", padding: "64px 24px", background: "#fff", borderRadius: 16, border: "1.5px dashed #E5E7EB" }}>
        <div style={{
          width: 56, height: 56, borderRadius: "50%", background: "#CCFBF1",
          display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px"
        }}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#0D9488" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
        </div>
        <p style={{ fontSize: 16, fontWeight: 700, color: "#111827", margin: "0 0 6px" }}>No medications added yet</p>
        <p style={{ fontSize: 13, color: "#9CA3AF", margin: "0 0 20px" }}>Add medicines manually or scan barcodes/prescriptions.</p>
        <Link href="/patients/add-medication" style={{
          display: "inline-flex", alignItems: "center", gap: 7,
          padding: "10px 20px", borderRadius: 10, background: "#0D9488", color: "#fff",
          textDecoration: "none", fontSize: 14, fontWeight: 700
        }}>
          + Add Medication
        </Link>
      </div>
    );
  }

  return (
    <div style={{ textAlign: "center", padding: "64px 24px", background: "#fff", borderRadius: 16, border: "1.5px dashed #E5E7EB" }}>
      <div style={{
        width: 56, height: 56, borderRadius: "50%", background: "#F0FDF4",
        display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px"
      }}>
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
      </div>
      <p style={{ fontSize: 16, fontWeight: 700, color: "#111827", margin: "0 0 6px" }}>No patients yet</p>
      <p style={{ fontSize: 13, color: "#9CA3AF", margin: "0 0 20px" }}>Add your first patient to begin monitoring.</p>
      <Link href="/patients/new" style={{
        display: "inline-flex", alignItems: "center", gap: 7,
        padding: "10px 20px", borderRadius: 10, background: "#0D9488", color: "#fff",
        textDecoration: "none", fontSize: 14, fontWeight: 700
      }}>
        + Add Patient
      </Link>
    </div>
  );
}

function Skeleton() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {[1, 2, 3].map(i => (
        <div key={i} style={{ height: 84, borderRadius: 14, background: "#F3F4F6", animation: "pulse 1.5s ease-in-out infinite" }} />
      ))}
    </div>
  );
}

function PatientsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const qTab = searchParams.get("tab");
  const initialTab = qTab === "medications" ? "medications" : "patients";

  const [tab, setTab] = useState<"patients" | "medications">(initialTab);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [medications, setMedications] = useState<Medication[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [toast, setToast] = useState<string | null>(null);

  // Twilio Communication Modals
  const [smsModalPatient, setSmsModalPatient] = useState<Patient | null>(null);
  const [callModalPatient, setCallModalPatient] = useState<Patient | null>(null);

  useEffect(() => {
    if (searchParams.get("tab") === "medications") {
      setTab("medications");
    } else {
      setTab("patients");
    }
  }, [searchParams]);

  const refreshAll = () => {
    setPatients(getPatients());
    setMedications(getMedications());
  };

  useEffect(() => {
    refreshAll();
    setLoading(false);

    const msg = sessionStorage.getItem("raksha_toast");
    if (msg) {
      setToast(msg);
      sessionStorage.removeItem("raksha_toast");
      setTimeout(() => setToast(null), 3000);
    }
  }, []);

  function handleTabChange(nextTab: "patients" | "medications") {
    setTab(nextTab);
    router.replace(`/patients?tab=${nextTab}`, { scroll: false });
  }

  function handleDeletePatient(id: string, name: string) {
    if (!confirm(`Delete patient "${name}" and all their medications?`)) return;
    deletePatient(id);
    refreshAll();
    setToast(`Patient "${name}" deleted.`);
    setTimeout(() => setToast(null), 3000);
  }

  function handleDeleteMed(medId: string, medName: string) {
    if (!confirm(`Delete medication "${medName}"?`)) return;
    deleteMedication(medId);
    setMedications(getMedications());
    setToast(`Medication "${medName}" deleted.`);
    setTimeout(() => setToast(null), 3000);
  }

  // Filtered patients
  const filteredPatients = patients.filter(p =>
    !search ||
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.conditions.some(c => c.toLowerCase().includes(search.toLowerCase())) ||
    medications.some(m => m.patientId === p.id && m.name.toLowerCase().includes(search.toLowerCase()))
  );

  // Filtered medications
  const filteredMedications = medications.filter(m => {
    const pat = patients.find(p => p.id === m.patientId);
    const patName = pat ? pat.name.toLowerCase() : "";
    return (
      !search ||
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      m.dosage.toLowerCase().includes(search.toLowerCase()) ||
      m.schedule.toLowerCase().includes(search.toLowerCase()) ||
      patName.includes(search.toLowerCase())
    );
  });

  const today = new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  return (
    <div style={{ minHeight: "100vh", background: "#F9FAFB", fontFamily: "Inter,ui-sans-serif,system-ui,sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        * { box-sizing:border-box; }
        @keyframes fadeUp { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        .fade-up { animation:fadeUp 0.3s ease-out both; }
        .patient-card:hover { border-color:#0D9488 !important; box-shadow:0 4px 16px rgba(13,148,136,0.12) !important; }
        .med-card:hover { border-color:#0D9488 !important; box-shadow:0 4px 16px rgba(13,148,136,0.12) !important; }
        .del-btn:hover { background:#FEE2E2 !important; color:#DC2626 !important; }
      `}</style>

      {/* Toast */}
      {toast && (
        <div style={{
          position: "fixed", bottom: 28, right: 28, zIndex: 99999,
          background: "#111827", color: "#fff", padding: "12px 20px", borderRadius: 12,
          fontSize: 13, fontWeight: 600, boxShadow: "0 8px 24px rgba(0,0,0,0.2)",
          animation: "fadeUp 0.25s ease-out"
        }}>
          ✓ {toast}
        </div>
      )}

      {/* Header */}
      <header style={{
        background: "#fff", borderBottom: "1px solid #E5E7EB", padding: "0 32px",
        height: 64, display: "flex", alignItems: "center", justifyContent: "space-between",
        position: "sticky", top: 0, zIndex: 30, boxShadow: "0 1px 3px rgba(0,0,0,0.04)"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{
            width: 38, height: 38, borderRadius: 10, background: "#0D9488",
            display: "flex", alignItems: "center", justifyContent: "center"
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
            </svg>
          </div>
          <div>
            <p style={{ margin: 0, fontSize: 17, fontWeight: 800, color: "#111827", letterSpacing: "-0.02em" }}>
              Patient & Care Hub
            </p>
            <p style={{ margin: 0, fontSize: 11, color: "#9CA3AF" }}>{today}</p>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <Link href="/patients/add-medication" style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "8px 14px", borderRadius: 9, border: "1.5px solid #0D9488",
            color: "#0D9488", textDecoration: "none", fontSize: 13, fontWeight: 700, background: "#fff"
          }}>
            + Add Med
          </Link>
          <Link href="/patients/new" style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "8px 14px", borderRadius: 9, background: "#0D9488",
            color: "#fff", textDecoration: "none", fontSize: 13, fontWeight: 700
          }}>
            + Add Patient
          </Link>
          <Link href="/today" style={{
            display: "inline-flex", alignItems: "center", gap: 5,
            padding: "8px 14px", borderRadius: 9, background: "#00C896",
            color: "#fff", textDecoration: "none", fontSize: 13, fontWeight: 700
          }}>
            📅 Today&apos;s Schedule
          </Link>
        </div>
      </header>

      <main style={{ maxWidth: 940, margin: "0 auto", padding: "32px 24px 64px" }}>
        {/* Stats Row */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 14, marginBottom: 24 }} className="fade-up">
          <div style={{
            background: "#fff", border: "1px solid #E5E7EB", borderRadius: 14,
            padding: "18px 22px", boxShadow: "0 1px 3px rgba(0,0,0,0.04)"
          }}>
            <p style={{ margin: "0 0 4px", fontSize: 11, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Registered Patients
            </p>
            <p style={{ margin: 0, fontSize: 28, fontWeight: 800, color: "#111827", letterSpacing: "-0.03em" }}>
              {patients.length}
            </p>
          </div>

          <div style={{
            background: "#fff", border: "1px solid #E5E7EB", borderRadius: 14,
            padding: "18px 22px", boxShadow: "0 1px 3px rgba(0,0,0,0.04)"
          }}>
            <p style={{ margin: "0 0 4px", fontSize: 11, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Active Medications
            </p>
            <p style={{ margin: 0, fontSize: 28, fontWeight: 800, color: "#2563EB", letterSpacing: "-0.03em" }}>
              {medications.length}
            </p>
          </div>
        </div>

        {/* 2-Way Tab Switcher */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          marginBottom: 20, gap: 16, flexWrap: "wrap"
        }} className="fade-up">
          <div style={{
            display: "inline-flex", background: "#E5E7EB", padding: 3, borderRadius: 12
          }}>
            <button
              onClick={() => handleTabChange("patients")}
              style={{
                display: "flex", alignItems: "center", gap: 7,
                padding: "8px 16px", borderRadius: 10, border: "none",
                background: tab === "patients" ? "#fff" : "transparent",
                color: tab === "patients" ? "#111827" : "#6B7280",
                fontSize: 13, fontWeight: 700, cursor: "pointer",
                boxShadow: tab === "patients" ? "0 2px 6px rgba(0,0,0,0.08)" : "none",
                transition: "all 0.15s"
              }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
              Patients ({patients.length})
            </button>

            <button
              onClick={() => handleTabChange("medications")}
              style={{
                display: "flex", alignItems: "center", gap: 7,
                padding: "8px 16px", borderRadius: 10, border: "none",
                background: tab === "medications" ? "#fff" : "transparent",
                color: tab === "medications" ? "#0D9488" : "#6B7280",
                fontSize: 13, fontWeight: 700, cursor: "pointer",
                boxShadow: tab === "medications" ? "0 2px 6px rgba(0,0,0,0.08)" : "none",
                transition: "all 0.15s"
              }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
              All Medications ({medications.length})
            </button>
          </div>

          {/* Search Bar */}
          <div style={{ position: "relative", flex: 1, minWidth: 260 }}>
            <svg
              style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)" }}
              width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2"
            >
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={
                tab === "patients"
                  ? "Search patient name, condition..."
                  : "Search medication name, dosage, or patient..."
              }
              style={{
                width: "100%", padding: "9px 14px 9px 36px", borderRadius: 11,
                border: "1.5px solid #E5E7EB", fontSize: 13, outline: "none",
                background: "#fff", color: "#111827", transition: "border-color 0.15s"
              }}
              onFocus={e => (e.target.style.borderColor = "#0D9488")}
              onBlur={e => (e.target.style.borderColor = "#E5E7EB")}
            />
          </div>
        </div>

        {/* Tab Content */}
        <div className="fade-up">
          {loading ? (
            <Skeleton />
          ) : tab === "patients" ? (
            patients.length === 0 ? (
              <EmptyState tab="patients" />
            ) : filteredPatients.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px", color: "#9CA3AF", fontSize: 14 }}>
                No patients match &quot;{search}&quot;
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {filteredPatients.map((p, i) => {
                  const patientMeds = medications.filter(m => m.patientId === p.id);

                  return (
                    <PatientCard
                      key={p.id}
                      patient={p}
                      meds={patientMeds}
                      delay={i * 30}
                      onDelete={handleDeletePatient}
                      onSendSms={() => setSmsModalPatient(p)}
                      onCall={() => setCallModalPatient(p)}
                    />
                  );
                })}
              </div>
            )
          ) : (
            medications.length === 0 ? (
              <EmptyState tab="medications" />
            ) : filteredMedications.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px", color: "#9CA3AF", fontSize: 14 }}>
                No medications match &quot;{search}&quot;
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {filteredMedications.map((m, i) => {
                  const pat = patients.find(p => p.id === m.patientId);
                  return (
                    <MedicationHubCard
                      key={m.id}
                      med={m}
                      patient={pat}
                      delay={i * 30}
                      onDelete={() => handleDeleteMed(m.id, m.name)}
                    />
                  );
                })}
              </div>
            )
          )}
        </div>
      </main>

      {/* Twilio SMS & Call Modals */}
      <SendSmsModal
        isOpen={!!smsModalPatient}
        onClose={() => setSmsModalPatient(null)}
        patient={smsModalPatient}
        onSuccess={(msg) => setToast(msg)}
      />
      <CallCaregiverModal
        isOpen={!!callModalPatient}
        onClose={() => setCallModalPatient(null)}
        patient={callModalPatient}
        onSuccess={(msg) => setToast(msg)}
      />
    </div>
  );
}

function PatientCard({
  patient: p,
  meds,
  delay,
  onDelete,
  onSendSms,
  onCall,
}: {
  patient: Patient;
  meds: Medication[];
  delay: number;
  onDelete: (id: string, name: string) => void;
  onSendSms: () => void;
  onCall: () => void;
}) {
  const initials = p.name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
  const primaryCaregiver = getPrimaryCaregiver(p);

  return (
    <div
      className="patient-card"
      style={{
        background: "#fff", border: "1.5px solid #E5E7EB", borderRadius: 14,
        padding: "18px 20px", display: "flex", flexDirection: "column", gap: 12,
        boxShadow: "0 1px 3px rgba(0,0,0,0.04)", transition: "all 0.18s",
        animation: `fadeUp 0.3s ease-out ${delay}ms both`
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
        <Link href={`/patients/${p.id}`} style={{
          width: 44, height: 44, borderRadius: 12, background: "#E0F2FE",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 14, fontWeight: 800, color: "#0284C7", flexShrink: 0, textDecoration: "none"
        }}>
          {initials}
        </Link>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <Link href={`/patients/${p.id}`} style={{ textDecoration: "none" }}>
              <p style={{ margin: "0 0 2px", fontSize: 16, fontWeight: 800, color: "#111827" }}>
                {p.name}
              </p>
            </Link>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <button
                onClick={onSendSms}
                style={{
                  fontSize: 11, fontWeight: 700, color: "#065F46",
                  padding: "4px 9px", borderRadius: 7, background: "#ECFDF5", border: "1px solid #A7F3D0", cursor: "pointer",
                  display: "inline-flex", alignItems: "center", gap: 3
                }}
                title="Send SMS to caregiver via Twilio"
              >
                💬 SMS
              </button>
              <button
                onClick={onCall}
                style={{
                  fontSize: 11, fontWeight: 700, color: "#1E3A8A",
                  padding: "4px 9px", borderRadius: 7, background: "#EFF6FF", border: "1px solid #BFDBFE", cursor: "pointer",
                  display: "inline-flex", alignItems: "center", gap: 3
                }}
                title="Call caregiver"
              >
                📞 Call
              </button>
              <Link
                href={`/patients/add-medication?patientId=${p.id}`}
                style={{
                  fontSize: 11, fontWeight: 700, color: "#2563EB",
                  padding: "4px 8px", borderRadius: 7, background: "#EFF6FF",
                  textDecoration: "none"
                }}
              >
                + Med
              </Link>
              <button
                className="del-btn"
                onClick={() => onDelete(p.id, p.name)}
                title="Delete patient"
                style={{
                  width: 28, height: 28, borderRadius: 7, border: "1px solid #F3F4F6",
                  background: "#fff", cursor: "pointer", display: "flex", alignItems: "center",
                  justifyContent: "center", flexShrink: 0, transition: "all 0.15s"
                }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
              </button>
            </div>
          </div>

          <p style={{ margin: 0, fontSize: 12, color: "#6B7280" }}>
            {p.age ? `${p.age} yrs` : "Age unknown"}
            {p.phone && ` • ${p.phone}`}
          </p>

          {/* Caregiver info + Last SMS Note */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4, flexWrap: "wrap" }}>
            {primaryCaregiver && (
              <span style={{
                fontSize: 11, fontWeight: 600, color: "#475569", background: "#F8FAFC",
                padding: "2px 8px", borderRadius: 6, border: "1px solid #E2E8F0"
              }}>
                👤 Caregiver: <strong style={{ color: "#0F172A" }}>{primaryCaregiver.name}</strong> ({primaryCaregiver.relation} • {primaryCaregiver.phone})
              </span>
            )}
            <LastSmsNote patientId={p.id} />
          </div>

          <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap", alignItems: "center" }}>
            {p.hasDiabetes && (
              <span style={{
                padding: "2px 8px", borderRadius: 5, background: "#EFF6FF",
                fontSize: 11, fontWeight: 700, color: "#2563EB", border: "1px solid #DBEAFE"
              }}>🩺 Diabetes</span>
            )}
            {p.hasHypertension && (
              <span style={{
                padding: "2px 8px", borderRadius: 5, background: "#FEF2F2",
                fontSize: 11, fontWeight: 700, color: "#DC2626", border: "1px solid #FEE2E2"
              }}>💓 Hypertension</span>
            )}
            {p.conditions.map(c => (
              <span key={c} style={{
                padding: "2px 8px", borderRadius: 5, background: "#F3F4F6",
                fontSize: 11, fontWeight: 600, color: "#374151"
              }}>{c}</span>
            ))}
          </div>
        </div>
      </div>

      {/* Patient Summary Footer */}
      <div style={{
        paddingTop: 10, borderTop: "1px solid #F3F4F6",
        display: "flex", alignItems: "center", justifyContent: "space-between"
      }}>
        <span style={{ fontSize: 12, color: "#6B7280", fontWeight: 600 }}>
          💊 {meds.length} Active Medication{meds.length !== 1 ? "s" : ""}
        </span>

        <Link href={`/patients/${p.id}`} style={{
          fontSize: 12, fontWeight: 700, color: "#0D9488", textDecoration: "none"
        }}>
          View Details →
        </Link>
      </div>
    </div>
  );
}

function MedicationHubCard({
  med: m,
  patient,
  delay,
  onDelete
}: {
  med: Medication;
  patient?: Patient;
  delay: number;
  onDelete: () => void;
}) {
  return (
    <div
      className="med-card"
      style={{
        background: "#fff", border: "1.5px solid #E5E7EB", borderRadius: 14,
        padding: "16px 20px", display: "flex", alignItems: "flex-start", gap: 16,
        boxShadow: "0 1px 3px rgba(0,0,0,0.04)", borderLeft: "4px solid #0D9488",
        transition: "all 0.18s", animation: `fadeUp 0.3s ease-out ${delay}ms both`
      }}
    >
      <div style={{
        width: 40, height: 40, borderRadius: 10, background: "#CCFBF1",
        display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0
      }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0D9488" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span style={{ fontSize: 16, fontWeight: 800, color: "#111827" }}>{m.name}</span>
              {(m.dosage || m.unit) && (
                <span style={{
                  padding: "2px 8px", borderRadius: 5, background: "#F0FDF4",
                  color: "#16A34A", fontSize: 12, fontWeight: 700
                }}>
                  {m.dosage} {m.unit}
                </span>
              )}
              <span style={{
                padding: "2px 8px", borderRadius: 5, background: "#EFF6FF",
                color: "#2563EB", fontSize: 12, fontWeight: 600
              }}>
                {m.schedule}
              </span>
            </div>

            {/* Linked Patient */}
            {patient && (
              <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 11, color: "#9CA3AF" }}>Prescribed for:</span>
                <Link
                  href={`/patients/${patient.id}`}
                  style={{
                    fontSize: 12, fontWeight: 700, color: "#0D9488",
                    textDecoration: "none", background: "#F0FDFA", padding: "1px 7px", borderRadius: 4
                  }}
                >
                  👤 {patient.name} {patient.age ? `(${patient.age} yrs)` : ""}
                </Link>
              </div>
            )}
          </div>

          <button
            onClick={onDelete}
            title="Delete medication"
            style={{
              width: 28, height: 28, borderRadius: 7, border: "1px solid #FEE2E2",
              background: "#FFF5F5", cursor: "pointer", display: "flex", alignItems: "center",
              justifyContent: "center", flexShrink: 0, marginLeft: 8, transition: "all 0.15s"
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
          </button>
        </div>

        {m.notes && (
          <p style={{ margin: "8px 0 0", fontSize: 12, color: "#6B7280", lineHeight: 1.5 }}>
            {m.notes}
          </p>
        )}
      </div>
    </div>
  );
}

export default function PatientsPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: "100vh", background: "#F9FAFB" }} />}>
      <PatientsContent />
    </Suspense>
  );
}
