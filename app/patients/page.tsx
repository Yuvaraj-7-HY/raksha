"use client";

import { useEffect, useState, Suspense, useMemo } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import {
  getPatients,
  deletePatient,
  getMedications,
  deleteMedication,
  getVitals,
  deleteVitalReading,
  addVitalReading,
  getBloodSugarStatus,
  getBloodPressureStatus,
} from "@/lib/storage";
import type { Patient, Medication, VitalReading } from "@/types";

function EmptyState({ tab }: { tab: "patients" | "vitals" | "medications" }) {
  if (tab === "vitals") {
    return (
      <div style={{ textAlign: "center", padding: "64px 24px", background: "#fff", borderRadius: 16, border: "1.5px dashed #E5E7EB" }}>
        <div style={{
          width: 56, height: 56, borderRadius: "50%", background: "#EFF6FF",
          display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px"
        }}>
          <span style={{ fontSize: 24 }}>🩸</span>
        </div>
        <p style={{ fontSize: 16, fontWeight: 700, color: "#111827", margin: "0 0 6px" }}>No vitals recorded yet</p>
        <p style={{ fontSize: 13, color: "#9CA3AF", margin: "0 0 20px" }}>Log blood glucose and blood pressure readings for your patients.</p>
      </div>
    );
  }

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

function toLocalDatetimeString(d = new Date()) {
  const pad = (n: number) => String(n).padStart(2, "0");
  const year = d.getFullYear();
  const month = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const hours = pad(d.getHours());
  const minutes = pad(d.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function PatientsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const qTab = searchParams.get("tab");
  const initialTab = qTab === "vitals" ? "vitals" : qTab === "medications" ? "medications" : "patients";

  const [tab, setTab] = useState<"patients" | "vitals" | "medications">(initialTab);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [medications, setMedications] = useState<Medication[]>([]);
  const [vitals, setVitals] = useState<VitalReading[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [toast, setToast] = useState<string | null>(null);

  // Quick modals for adding vitals
  const [modalType, setModalType] = useState<"sugar" | "bp" | null>(null);
  const [modalPatientId, setModalPatientId] = useState("");
  const [sugarVal, setSugarVal] = useState("");
  const [sugarDate, setSugarDate] = useState("");
  const [sugarNotes, setSugarNotes] = useState("");
  const [bpSys, setBpSys] = useState("");
  const [bpDia, setBpDia] = useState("");
  const [bpDate, setBpDate] = useState("");
  const [bpNotes, setBpNotes] = useState("");

  useEffect(() => {
    if (searchParams.get("tab") === "vitals") {
      setTab("vitals");
    } else if (searchParams.get("tab") === "medications") {
      setTab("medications");
    } else if (searchParams.get("tab") === "patients") {
      setTab("patients");
    }
  }, [searchParams]);

  const refreshAll = () => {
    setPatients(getPatients());
    setMedications(getMedications());
    setVitals(getVitals());
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

  function handleTabChange(nextTab: "patients" | "vitals" | "medications") {
    setTab(nextTab);
    router.replace(`/patients?tab=${nextTab}`, { scroll: false });
  }

  function handleDeletePatient(id: string, name: string) {
    if (!confirm(`Delete patient "${name}" and all their medications and vitals?`)) return;
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

  function handleDeleteVital(vitalId: string) {
    if (!confirm("Delete this vital reading?")) return;
    deleteVitalReading(vitalId);
    setVitals(getVitals());
    setToast("Vital reading deleted.");
    setTimeout(() => setToast(null), 3000);
  }

  function openAddSugar(patientId?: string) {
    const pid = patientId || (patients[0]?.id ?? "");
    setModalPatientId(pid);
    setSugarVal("");
    setSugarDate(toLocalDatetimeString());
    setSugarNotes("");
    setModalType("sugar");
  }

  function openAddBP(patientId?: string) {
    const pid = patientId || (patients[0]?.id ?? "");
    setModalPatientId(pid);
    setBpSys("");
    setBpDia("");
    setBpDate(toLocalDatetimeString());
    setBpNotes("");
    setModalType("bp");
  }

  function handleSaveSugar(e: React.FormEvent) {
    e.preventDefault();
    const val = Number(sugarVal);
    if (!val || val <= 0 || !modalPatientId) return;
    const measuredAt = sugarDate ? new Date(sugarDate).toISOString() : new Date().toISOString();
    addVitalReading({
      patientId: modalPatientId,
      type: "blood_sugar",
      value: val,
      measuredAt,
      notes: sugarNotes.trim() || undefined,
    });
    setModalType(null);
    refreshAll();
    const targetPatient = patients.find(p => p.id === modalPatientId);
    setToast(`Blood sugar (${val} mg/dL) saved for ${targetPatient?.name || "patient"}!`);
    setTimeout(() => setToast(null), 3000);
  }

  function handleSaveBP(e: React.FormEvent) {
    e.preventDefault();
    const sys = Number(bpSys);
    const dia = Number(bpDia);
    if (!sys || !dia || sys <= 0 || dia <= 0 || !modalPatientId) return;
    const measuredAt = bpDate ? new Date(bpDate).toISOString() : new Date().toISOString();
    addVitalReading({
      patientId: modalPatientId,
      type: "blood_pressure",
      systolic: sys,
      diastolic: dia,
      measuredAt,
      notes: bpNotes.trim() || undefined,
    });
    setModalType(null);
    refreshAll();
    const targetPatient = patients.find(p => p.id === modalPatientId);
    setToast(`Blood pressure (${sys}/${dia} mmHg) saved for ${targetPatient?.name || "patient"}!`);
    setTimeout(() => setToast(null), 3000);
  }

  // Filtered patients
  const filteredPatients = patients.filter(p =>
    !search ||
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.conditions.some(c => c.toLowerCase().includes(search.toLowerCase())) ||
    medications.some(m => m.patientId === p.id && m.name.toLowerCase().includes(search.toLowerCase()))
  );

  // Filtered vitals
  const filteredVitals = vitals
    .slice()
    .sort((a, b) => new Date(b.measuredAt).getTime() - new Date(a.measuredAt).getTime())
    .filter(v => {
      const pat = patients.find(p => p.id === v.patientId);
      const patName = pat ? pat.name.toLowerCase() : "";
      const query = search.toLowerCase();
      return (
        !search ||
        patName.includes(query) ||
        (v.type === "blood_sugar" && String(v.value).includes(query)) ||
        (v.type === "blood_pressure" && `${v.systolic}/${v.diastolic}`.includes(query)) ||
        (v.notes && v.notes.toLowerCase().includes(query))
      );
    });

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
          <button
            onClick={() => openAddSugar()}
            style={{
              display: "inline-flex", alignItems: "center", gap: 5, padding: "8px 13px",
              borderRadius: 9, background: "#0D9488", color: "#fff", border: "none",
              fontSize: 12, fontWeight: 700, cursor: "pointer",
            }}
          >
            + Add Sugar
          </button>
          <button
            onClick={() => openAddBP()}
            style={{
              display: "inline-flex", alignItems: "center", gap: 5, padding: "8px 13px",
              borderRadius: 9, background: "#1E293B", color: "#fff", border: "none",
              fontSize: 12, fontWeight: 700, cursor: "pointer",
            }}
          >
            + Add BP
          </button>
          <Link href="/patients/add-medication" style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "7px 14px", borderRadius: 9, border: "1.5px solid #0D9488",
            color: "#0D9488", textDecoration: "none", fontSize: 12, fontWeight: 700, background: "#fff"
          }}>
            + Add Med
          </Link>
          <Link href="/patients/new" style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "8px 14px", borderRadius: 9, background: "#0D9488",
            color: "#fff", textDecoration: "none", fontSize: 12, fontWeight: 700
          }}>
            + Add Patient
          </Link>
          <Link href="/dashboard" style={{
            padding: "8px 12px", borderRadius: 9,
            border: "1px solid #E5E7EB", color: "#6B7280", textDecoration: "none", fontSize: 12, fontWeight: 600, background: "#fff"
          }}>
            ← Dashboard
          </Link>
        </div>
      </header>

      <main style={{ maxWidth: 940, margin: "0 auto", padding: "32px 24px 64px" }}>
        {/* Stats Row */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginBottom: 24 }} className="fade-up">
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
              Vitals Logged
            </p>
            <p style={{ margin: 0, fontSize: 28, fontWeight: 800, color: "#0D9488", letterSpacing: "-0.03em" }}>
              {vitals.length}
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

        {/* Unified 3-Way Tab Switcher */}
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
              onClick={() => handleTabChange("vitals")}
              style={{
                display: "flex", alignItems: "center", gap: 7,
                padding: "8px 16px", borderRadius: 10, border: "none",
                background: tab === "vitals" ? "#fff" : "transparent",
                color: tab === "vitals" ? "#0D9488" : "#6B7280",
                fontSize: 13, fontWeight: 700, cursor: "pointer",
                boxShadow: tab === "vitals" ? "0 2px 6px rgba(0,0,0,0.08)" : "none",
                transition: "all 0.15s"
              }}
            >
              <span style={{ fontSize: 14 }}>🩸</span>
              Vitals Log ({vitals.length})
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
                  : tab === "vitals"
                  ? "Search vitals by patient, reading, or notes..."
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
                  const patientVitals = vitals.filter(v => v.patientId === p.id);
                  const latestSugar = patientVitals.find(v => v.type === "blood_sugar");
                  const latestBP = patientVitals.find(v => v.type === "blood_pressure");

                  return (
                    <PatientCardWithVitals
                      key={p.id}
                      patient={p}
                      meds={patientMeds}
                      latestSugar={latestSugar}
                      latestBP={latestBP}
                      delay={i * 30}
                      onDelete={handleDeletePatient}
                      onAddSugar={() => openAddSugar(p.id)}
                      onAddBP={() => openAddBP(p.id)}
                    />
                  );
                })}
              </div>
            )
          ) : tab === "vitals" ? (
            vitals.length === 0 ? (
              <EmptyState tab="vitals" />
            ) : filteredVitals.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px", color: "#9CA3AF", fontSize: 14 }}>
                No vitals match &quot;{search}&quot;
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {filteredVitals.map((v, i) => {
                  const pat = patients.find(p => p.id === v.patientId);
                  return (
                    <VitalHubCard
                      key={v.id}
                      vital={v}
                      patient={pat}
                      delay={i * 25}
                      onDelete={() => handleDeleteVital(v.id)}
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

      {/* ══════════════════════════════════════════════════════════════════════════
          MODAL: ADD BLOOD SUGAR
      ══════════════════════════════════════════════════════════════════════════ */}
      {modalType === "sugar" && (
        <div style={modalOverlayStyle} onClick={() => setModalType(null)}>
          <div style={modalBoxStyle} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 20 }}>🩸</span>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "#111827" }}>Add Blood Sugar Reading</h3>
              </div>
              <button
                onClick={() => setModalType(null)}
                style={{ border: "none", background: "none", fontSize: 18, cursor: "pointer", color: "#9CA3AF" }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveSugar} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <label style={lblStyle}>Select Patient *</label>
                <select
                  required
                  value={modalPatientId}
                  onChange={e => setModalPatientId(e.target.value)}
                  style={{ ...inpStyle, cursor: "pointer" }}
                >
                  {patients.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} {p.age ? `(${p.age} yrs)` : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={lblStyle}>Glucose Level (mg/dL) *</label>
                <input
                  type="number"
                  step="1"
                  min="20"
                  max="600"
                  required
                  autoFocus
                  placeholder="e.g. 110"
                  value={sugarVal}
                  onChange={e => setSugarVal(e.target.value)}
                  style={inpStyle}
                />
                {sugarVal && (
                  <div style={{ marginTop: 8 }}>
                    {(() => {
                      const st = getBloodSugarStatus(Number(sugarVal));
                      return (
                        <span style={{
                          display: "inline-block", padding: "3px 10px", borderRadius: 999,
                          fontSize: 11, fontWeight: 700, background: st.bg, color: st.color, border: `1px solid ${st.border}`
                        }}>
                          Status: {st.label} (Normal: 70–140 mg/dL)
                        </span>
                      );
                    })()}
                  </div>
                )}
              </div>

              <div>
                <label style={lblStyle}>Measured At</label>
                <input
                  type="datetime-local"
                  required
                  value={sugarDate}
                  onChange={e => setSugarDate(e.target.value)}
                  style={inpStyle}
                />
              </div>

              <div>
                <label style={lblStyle}>Notes (optional)</label>
                <input
                  placeholder="e.g. Fasting, 2h post-meal, after exercise"
                  value={sugarNotes}
                  onChange={e => setSugarNotes(e.target.value)}
                  style={inpStyle}
                />
              </div>

              <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
                <button
                  type="button"
                  onClick={() => setModalType(null)}
                  style={{
                    flex: 1, padding: "10px", borderRadius: 9, border: "1.5px solid #E5E7EB",
                    background: "#fff", color: "#6B7280", fontWeight: 700, cursor: "pointer"
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!sugarVal || !modalPatientId}
                  style={{
                    flex: 2, padding: "10px", borderRadius: 9, border: "none",
                    background: sugarVal && modalPatientId ? "#0D9488" : "#D1D5DB", color: "#fff",
                    fontWeight: 700, cursor: sugarVal && modalPatientId ? "pointer" : "not-allowed"
                  }}
                >
                  Save Reading
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════════
          MODAL: ADD BLOOD PRESSURE
      ══════════════════════════════════════════════════════════════════════════ */}
      {modalType === "bp" && (
        <div style={modalOverlayStyle} onClick={() => setModalType(null)}>
          <div style={modalBoxStyle} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 20 }}>💓</span>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "#111827" }}>Add Blood Pressure Reading</h3>
              </div>
              <button
                onClick={() => setModalType(null)}
                style={{ border: "none", background: "none", fontSize: 18, cursor: "pointer", color: "#9CA3AF" }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveBP} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <label style={lblStyle}>Select Patient *</label>
                <select
                  required
                  value={modalPatientId}
                  onChange={e => setModalPatientId(e.target.value)}
                  style={{ ...inpStyle, cursor: "pointer" }}
                >
                  {patients.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} {p.age ? `(${p.age} yrs)` : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={lblStyle}>Systolic (mmHg) *</label>
                  <input
                    type="number"
                    step="1"
                    min="50"
                    max="260"
                    required
                    autoFocus
                    placeholder="e.g. 120"
                    value={bpSys}
                    onChange={e => setBpSys(e.target.value)}
                    style={inpStyle}
                  />
                </div>
                <div>
                  <label style={lblStyle}>Diastolic (mmHg) *</label>
                  <input
                    type="number"
                    step="1"
                    min="30"
                    max="180"
                    required
                    placeholder="e.g. 80"
                    value={bpDia}
                    onChange={e => setBpDia(e.target.value)}
                    style={inpStyle}
                  />
                </div>
              </div>

              {bpSys && bpDia && (
                <div>
                  {(() => {
                    const st = getBloodPressureStatus(Number(bpSys), Number(bpDia));
                    return (
                      <span style={{
                        display: "inline-block", padding: "3px 10px", borderRadius: 999,
                        fontSize: 11, fontWeight: 700, background: st.bg, color: st.color, border: `1px solid ${st.border}`
                      }}>
                        Status: {st.label} (Normal: &lt;120 and &lt;80 mmHg)
                      </span>
                    );
                  })()}
                </div>
              )}

              <div>
                <label style={lblStyle}>Measured At</label>
                <input
                  type="datetime-local"
                  required
                  value={bpDate}
                  onChange={e => setBpDate(e.target.value)}
                  style={inpStyle}
                />
              </div>

              <div>
                <label style={lblStyle}>Notes (optional)</label>
                <input
                  placeholder="e.g. Morning resting, after taking meds"
                  value={bpNotes}
                  onChange={e => setBpNotes(e.target.value)}
                  style={inpStyle}
                />
              </div>

              <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
                <button
                  type="button"
                  onClick={() => setModalType(null)}
                  style={{
                    flex: 1, padding: "10px", borderRadius: 9, border: "1.5px solid #E5E7EB",
                    background: "#fff", color: "#6B7280", fontWeight: 700, cursor: "pointer"
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!bpSys || !bpDia || !modalPatientId}
                  style={{
                    flex: 2, padding: "10px", borderRadius: 9, border: "none",
                    background: bpSys && bpDia && modalPatientId ? "#0D9488" : "#D1D5DB", color: "#fff",
                    fontWeight: 700, cursor: bpSys && bpDia && modalPatientId ? "pointer" : "not-allowed"
                  }}
                >
                  Save Reading
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function PatientCardWithVitals({
  patient: p,
  meds,
  latestSugar,
  latestBP,
  delay,
  onDelete,
  onAddSugar,
  onAddBP,
}: {
  patient: Patient;
  meds: Medication[];
  latestSugar?: VitalReading;
  latestBP?: VitalReading;
  delay: number;
  onDelete: (id: string, name: string) => void;
  onAddSugar: () => void;
  onAddBP: () => void;
}) {
  const initials = p.name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
  const sugarStatus = getBloodSugarStatus(latestSugar?.value);
  const bpStatus = getBloodPressureStatus(latestBP?.systolic, latestBP?.diastolic);

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
                onClick={onAddSugar}
                style={{
                  fontSize: 11, fontWeight: 700, color: "#0D9488",
                  padding: "4px 8px", borderRadius: 7, background: "#CCFBF1", border: "none", cursor: "pointer"
                }}
              >
                + Sugar
              </button>
              <button
                onClick={onAddBP}
                style={{
                  fontSize: 11, fontWeight: 700, color: "#1E293B",
                  padding: "4px 8px", borderRadius: 7, background: "#F1F5F9", border: "none", cursor: "pointer"
                }}
              >
                + BP
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

      {/* Connected Vitals Bar */}
      <div style={{
        paddingTop: 10, borderTop: "1px solid #F3F4F6",
        display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.04em" }}>
            Latest Vitals:
          </span>

          {latestSugar ? (
            <span style={{
              display: "inline-flex", alignItems: "center", gap: 5,
              padding: "2px 8px", borderRadius: 6, background: sugarStatus.bg,
              border: `1px solid ${sugarStatus.border}`, fontSize: 11, fontWeight: 700, color: sugarStatus.color
            }}>
              🩸 Sugar: {latestSugar.value} mg/dL ({sugarStatus.label})
            </span>
          ) : (
            <span style={{ fontSize: 11, color: "#9CA3AF", fontStyle: "italic" }}>No sugar logged</span>
          )}

          {latestBP ? (
            <span style={{
              display: "inline-flex", alignItems: "center", gap: 5,
              padding: "2px 8px", borderRadius: 6, background: bpStatus.bg,
              border: `1px solid ${bpStatus.border}`, fontSize: 11, fontWeight: 700, color: bpStatus.color
            }}>
              💓 BP: {latestBP.systolic}/{latestBP.diastolic} mmHg ({bpStatus.label})
            </span>
          ) : (
            <span style={{ fontSize: 11, color: "#9CA3AF", fontStyle: "italic" }}>No BP logged</span>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 11, color: "#9CA3AF" }}>
            {meds.length} Med{meds.length !== 1 ? "s" : ""}
          </span>
          <Link href={`/patients/${p.id}`} style={{
            fontSize: 12, fontWeight: 700, color: "#0D9488", textDecoration: "none"
          }}>
            View Details →
          </Link>
        </div>
      </div>
    </div>
  );
}

function VitalHubCard({
  vital: v,
  patient,
  delay,
  onDelete
}: {
  vital: VitalReading;
  patient?: Patient;
  delay: number;
  onDelete: () => void;
}) {
  const isSugar = v.type === "blood_sugar";
  const status = isSugar ? getBloodSugarStatus(v.value) : getBloodPressureStatus(v.systolic, v.diastolic);

  return (
    <div
      className="med-card"
      style={{
        background: "#fff", border: "1.5px solid #E5E7EB", borderRadius: 14,
        padding: "16px 20px", display: "flex", alignItems: "flex-start", gap: 16,
        boxShadow: "0 1px 3px rgba(0,0,0,0.04)", borderLeft: isSugar ? "4px solid #0D9488" : "4px solid #E11D48",
        transition: "all 0.18s", animation: `fadeUp 0.3s ease-out ${delay}ms both`
      }}
    >
      <div style={{
        width: 40, height: 40, borderRadius: 10, background: isSugar ? "#CCFBF1" : "#FEE2E2",
        display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0
      }}>
        <span style={{ fontSize: 20 }}>{isSugar ? "🩸" : "💓"}</span>
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span style={{ fontSize: 16, fontWeight: 800, color: "#111827" }}>
                {isSugar ? `${v.value} mg/dL` : `${v.systolic}/${v.diastolic} mmHg`}
              </span>
              <span style={{
                padding: "2px 8px", borderRadius: 5, background: status.bg,
                color: status.color, border: `1px solid ${status.border}`, fontSize: 11, fontWeight: 700
              }}>
                {status.label}
              </span>
              <span style={{ fontSize: 12, color: "#6B7280", fontWeight: 600 }}>
                {isSugar ? "Blood Glucose" : "Blood Pressure"}
              </span>
            </div>

            {/* Linked Patient */}
            {patient && (
              <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 11, color: "#9CA3AF" }}>Patient:</span>
                <Link
                  href={`/patients/${patient.id}`}
                  style={{
                    fontSize: 12, fontWeight: 700, color: "#0D9488",
                    textDecoration: "none", background: "#F0FDFA", padding: "1px 7px", borderRadius: 4
                  }}
                >
                  👤 {patient.name} {patient.age ? `(${patient.age} yrs)` : ""}
                </Link>
                <span style={{ fontSize: 11, color: "#9CA3AF" }}>
                  • {new Date(v.measuredAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
            )}
          </div>

          <button
            onClick={onDelete}
            title="Delete reading"
            style={{
              width: 28, height: 28, borderRadius: 7, border: "1px solid #FEE2E2",
              background: "#FFF5F5", cursor: "pointer", display: "flex", alignItems: "center",
              justifyContent: "center", flexShrink: 0, marginLeft: 8, transition: "all 0.15s"
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
          </button>
        </div>

        {v.notes && (
          <p style={{ margin: "6px 0 0", fontSize: 12, color: "#6B7280", lineHeight: 1.5 }}>
            &ldquo;{v.notes}&rdquo;
          </p>
        )}
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
