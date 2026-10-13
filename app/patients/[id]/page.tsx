"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
} from "recharts";
import {
  getPatientById,
  updatePatient,
  getMedsByPatient,
  deleteMedication,
  deletePatient,
  getVitalsByPatient,
  getLatestVital,
  getVitalsHistory,
  addVitalReading,
  deleteVitalReading,
  getBloodSugarStatus,
  getBloodPressureStatus,
} from "@/lib/storage";
import type { Patient, Medication, VitalReading } from "@/types";

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
  const [vitals, setVitals] = useState<VitalReading[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  // Modals state
  const [showSugarModal, setShowSugarModal] = useState(false);
  const [showBPModal, setShowBPModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

  // Blood sugar modal fields
  const [sugarVal, setSugarVal] = useState("");
  const [sugarDate, setSugarDate] = useState("");
  const [sugarNotes, setSugarNotes] = useState("");

  // Blood pressure modal fields
  const [bpSys, setBpSys] = useState("");
  const [bpDia, setBpDia] = useState("");
  const [bpDate, setBpDate] = useState("");
  const [bpNotes, setBpNotes] = useState("");

  // Edit patient fields
  const [editName, setEditName] = useState("");
  const [editAge, setEditAge] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editDiabetes, setEditDiabetes] = useState(false);
  const [editHypertension, setEditHypertension] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const loadData = useCallback(() => {
    const p = getPatientById(id);
    setPatient(p ?? null);
    if (p) {
      setMeds(getMedsByPatient(id));
      setVitals(getVitalsByPatient(id));
      setEditName(p.name);
      setEditAge(p.age !== null && p.age !== undefined ? String(p.age) : "");
      setEditPhone(p.phone || "");
      setEditDiabetes(Boolean(p.hasDiabetes));
      setEditHypertension(Boolean(p.hasHypertension));
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

  function toLocalDatetimeString(d = new Date()) {
    const pad = (n: number) => String(n).padStart(2, "0");
    const year = d.getFullYear();
    const month = pad(d.getMonth() + 1);
    const day = pad(d.getDate());
    const hours = pad(d.getHours());
    const minutes = pad(d.getMinutes());
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  }

  // Vitals metrics (strictly reactive from vitals state)
  const latestSugar = useMemo(() => {
    return vitals.find(v => v.type === "blood_sugar");
  }, [vitals]);

  const latestBP = useMemo(() => {
    return vitals.find(v => v.type === "blood_pressure");
  }, [vitals]);

  // 14-day history for charts
  const sugarChartData = useMemo(() => {
    const threshold = Date.now() - 14 * 86400000;
    return vitals
      .filter(v => v.type === "blood_sugar" && new Date(v.measuredAt).getTime() >= threshold)
      .sort((a, b) => new Date(a.measuredAt).getTime() - new Date(b.measuredAt).getTime())
      .map(item => ({
        date: new Date(item.measuredAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
        timestamp: new Date(item.measuredAt).getTime(),
        sugar: item.value,
        notes: item.notes,
      }));
  }, [vitals]);

  const bpChartData = useMemo(() => {
    const threshold = Date.now() - 14 * 86400000;
    return vitals
      .filter(v => v.type === "blood_pressure" && new Date(v.measuredAt).getTime() >= threshold)
      .sort((a, b) => new Date(a.measuredAt).getTime() - new Date(b.measuredAt).getTime())
      .map(item => ({
        date: new Date(item.measuredAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
        timestamp: new Date(item.measuredAt).getTime(),
        systolic: item.systolic,
        diastolic: item.diastolic,
        notes: item.notes,
      }));
  }, [vitals]);

  function handleDeleteMed(medId: string, medName: string) {
    if (!confirm(`Delete medication "${medName}"?`)) return;
    deleteMedication(medId);
    setMeds(getMedsByPatient(id));
    setToast(`${medName} deleted.`);
    setTimeout(() => setToast(null), 3000);
  }

  function handleDeletePatient() {
    if (!patient) return;
    if (!confirm(`Delete patient "${patient.name}" and all their medications and vitals?`)) return;
    deletePatient(id);
    sessionStorage.setItem("raksha_toast", `${patient.name} deleted.`);
    router.push("/patients");
  }

  function handleDeleteVital(vitalId: string) {
    if (!confirm("Delete this vital reading?")) return;
    deleteVitalReading(vitalId);
    setVitals(getVitalsByPatient(id));
    setToast("Reading deleted.");
    setTimeout(() => setToast(null), 3000);
  }

  // Open modals
  function openSugarModal() {
    setSugarVal("");
    setSugarDate(toLocalDatetimeString());
    setSugarNotes("");
    setShowSugarModal(true);
  }

  function openBPModal() {
    setBpSys("");
    setBpDia("");
    setBpDate(toLocalDatetimeString());
    setBpNotes("");
    setShowBPModal(true);
  }

  function handleSaveSugar(e: React.FormEvent) {
    e.preventDefault();
    const val = Number(sugarVal);
    if (!val || val <= 0) return;
    const measuredAt = sugarDate ? new Date(sugarDate).toISOString() : new Date().toISOString();
    addVitalReading({
      patientId: id,
      type: "blood_sugar",
      value: val,
      measuredAt,
      notes: sugarNotes.trim() || undefined,
    });
    setShowSugarModal(false);
    setVitals(getVitalsByPatient(id));
    setToast(`Blood sugar reading (${val} mg/dL) saved!`);
    setTimeout(() => setToast(null), 3000);
  }

  function handleSaveBP(e: React.FormEvent) {
    e.preventDefault();
    const sys = Number(bpSys);
    const dia = Number(bpDia);
    if (!sys || !dia || sys <= 0 || dia <= 0) return;
    const measuredAt = bpDate ? new Date(bpDate).toISOString() : new Date().toISOString();
    addVitalReading({
      patientId: id,
      type: "blood_pressure",
      systolic: sys,
      diastolic: dia,
      measuredAt,
      notes: bpNotes.trim() || undefined,
    });
    setShowBPModal(false);
    setVitals(getVitalsByPatient(id));
    setToast(`Blood pressure reading (${sys}/${dia} mmHg) saved!`);
    setTimeout(() => setToast(null), 3000);
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

  const sugarStatus = getBloodSugarStatus(latestSugar?.value);
  const bpStatus = getBloodPressureStatus(latestBP?.systolic, latestBP?.diastolic);

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
                    🩺 Diabetes Tracked
                  </span>
                )}
                {patient.hasHypertension && (
                  <span style={{
                    padding: "3px 9px", borderRadius: 6, background: "#FEF2F2",
                    color: "#DC2626", fontSize: 11, fontWeight: 700, border: "1px solid #FEE2E2",
                  }}>
                    💓 Hypertension Tracked
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

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
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
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 24 }} className="fade-up">
          <div style={{
            padding: "14px 18px", borderRadius: 12, background: "#fff",
            border: "1px solid #E5E7EB", boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
          }}>
            <p style={{ margin: "0 0 2px", fontSize: 11, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.06em" }}>Prescribed Medications</p>
            <p style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#111827" }}>{meds.length}</p>
          </div>
          <div style={{
            padding: "14px 18px", borderRadius: 12, background: "#fff",
            border: "1px solid #E5E7EB", boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
          }}>
            <p style={{ margin: "0 0 2px", fontSize: 11, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.06em" }}>Vitals Logged</p>
            <p style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#0D9488" }}>{vitals.length}</p>
          </div>
          <div style={{
            padding: "14px 18px", borderRadius: 12, background: "#fff",
            border: "1px solid #E5E7EB", boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
          }}>
            <p style={{ margin: "0 0 2px", fontSize: 11, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.06em" }}>Patient Since</p>
            <p style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "#2563EB" }}>
              {new Date(patient.createdAt).toLocaleDateString("en-IN", { month: "short", year: "numeric" })}
            </p>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════════════════════
            VITALS TRACKING SECTION
        ══════════════════════════════════════════════════════════════════════════ */}
        <section style={{ marginBottom: 36 }} className="fade-up">
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            marginBottom: 16, flexWrap: "wrap", gap: 12,
          }}>
            <div>
              <h2 style={{ margin: "0 0 2px", fontSize: 18, fontWeight: 800, color: "#111827", letterSpacing: "-0.01em" }}>
                Vitals Tracking
              </h2>
              <p style={{ margin: 0, fontSize: 12, color: "#6B7280" }}>
                Blood glucose and blood pressure monitoring with normal range classification
              </p>
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={openSugarModal}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px",
                  borderRadius: 9, background: "#0D9488", color: "#fff", border: "none",
                  fontSize: 12, fontWeight: 700, cursor: "pointer", boxShadow: "0 2px 6px rgba(13,148,136,0.2)",
                }}
              >
                + Add Blood Sugar
              </button>
              <button
                onClick={openBPModal}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px",
                  borderRadius: 9, background: "#1E293B", color: "#fff", border: "none",
                  fontSize: 12, fontWeight: 700, cursor: "pointer",
                }}
              >
                + Add Blood Pressure
              </button>
            </div>
          </div>

          {/* Latest Vitals Summary Cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14, marginBottom: 20 }}>
            {/* Blood Sugar Card */}
            <div style={{
              background: "#fff", border: "1.5px solid #E5E7EB", borderRadius: 16,
              padding: "20px", position: "relative", boxShadow: "0 1px 4px rgba(0,0,0,0.03)",
            }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: "#EFF6FF", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <span style={{ fontSize: 16 }}>🩸</span>
                  </div>
                  <span style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>Blood Sugar</span>
                </div>
                {latestSugar && (
                  <span style={{
                    padding: "3px 10px", borderRadius: 999, fontSize: 11, fontWeight: 700,
                    background: sugarStatus.bg, color: sugarStatus.color, border: `1px solid ${sugarStatus.border}`,
                  }}>
                    {sugarStatus.label}
                  </span>
                )}
              </div>

              {latestSugar ? (
                <div>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                    <span style={{ fontSize: 32, fontWeight: 800, color: "#111827", letterSpacing: "-0.03em" }}>
                      {latestSugar.value}
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "#6B7280" }}>mg/dL</span>
                  </div>
                  <p style={{ margin: "6px 0 0", fontSize: 12, color: "#9CA3AF" }}>
                    Measured {new Date(latestSugar.measuredAt).toLocaleString("en-IN", {
                      day: "numeric", month: "short", hour: "2-digit", minute: "2-digit"
                    })}
                    {latestSugar.notes && ` • ${latestSugar.notes}`}
                  </p>
                  <p style={{ margin: "4px 0 0", fontSize: 11, color: "#6B7280" }}>
                    Target Range: <strong style={{ color: "#059669" }}>70 – 140 mg/dL</strong>
                  </p>
                </div>
              ) : (
                <div style={{ padding: "12px 0" }}>
                  <p style={{ margin: "0 0 8px", fontSize: 13, color: "#9CA3AF", fontStyle: "italic" }}>
                    No blood sugar readings logged yet
                  </p>
                  <button
                    onClick={openSugarModal}
                    style={{ fontSize: 12, color: "#0D9488", fontWeight: 700, background: "none", border: "none", padding: 0, cursor: "pointer" }}
                  >
                    + Record first reading
                  </button>
                </div>
              )}
            </div>

            {/* Blood Pressure Card */}
            <div style={{
              background: "#fff", border: "1.5px solid #E5E7EB", borderRadius: 16,
              padding: "20px", position: "relative", boxShadow: "0 1px 4px rgba(0,0,0,0.03)",
            }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: "#FEF2F2", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <span style={{ fontSize: 16 }}>💓</span>
                  </div>
                  <span style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>Blood Pressure</span>
                </div>
                {latestBP && (
                  <span style={{
                    padding: "3px 10px", borderRadius: 999, fontSize: 11, fontWeight: 700,
                    background: bpStatus.bg, color: bpStatus.color, border: `1px solid ${bpStatus.border}`,
                  }}>
                    {bpStatus.label}
                  </span>
                )}
              </div>

              {latestBP ? (
                <div>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                    <span style={{ fontSize: 32, fontWeight: 800, color: "#111827", letterSpacing: "-0.03em" }}>
                      {latestBP.systolic}/{latestBP.diastolic}
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "#6B7280" }}>mmHg</span>
                  </div>
                  <p style={{ margin: "6px 0 0", fontSize: 12, color: "#9CA3AF" }}>
                    Measured {new Date(latestBP.measuredAt).toLocaleString("en-IN", {
                      day: "numeric", month: "short", hour: "2-digit", minute: "2-digit"
                    })}
                    {latestBP.notes && ` • ${latestBP.notes}`}
                  </p>
                  <p style={{ margin: "4px 0 0", fontSize: 11, color: "#6B7280" }}>
                    Normal Threshold: <strong style={{ color: "#059669" }}>&lt; 120 / &lt; 80 mmHg</strong>
                  </p>
                </div>
              ) : (
                <div style={{ padding: "12px 0" }}>
                  <p style={{ margin: "0 0 8px", fontSize: 13, color: "#9CA3AF", fontStyle: "italic" }}>
                    No blood pressure readings logged yet
                  </p>
                  <button
                    onClick={openBPModal}
                    style={{ fontSize: 12, color: "#0D9488", fontWeight: 700, background: "none", border: "none", padding: 0, cursor: "pointer" }}
                  >
                    + Record first reading
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Vitals 14-Day Charts */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(400px, 1fr))", gap: 16, marginBottom: 20 }}>
            {/* Blood Sugar Chart */}
            <div style={{
              background: "#fff", border: "1.5px solid #E5E7EB", borderRadius: 16,
              padding: "20px 22px", boxShadow: "0 1px 4px rgba(0,0,0,0.03)",
            }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                <div>
                  <h3 style={{ margin: "0 0 2px", fontSize: 14, fontWeight: 700, color: "#111827" }}>
                    Blood Sugar — Last 14 Days
                  </h3>
                  <span style={{ fontSize: 11, color: "#9CA3AF" }}>Target: 70–140 mg/dL</span>
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, color: "#0D9488", background: "#CCFBF1", padding: "2px 8px", borderRadius: 6 }}>
                  mg/dL
                </span>
              </div>

              {sugarChartData.length === 0 ? (
                <div style={{ height: 180, display: "flex", alignItems: "center", justifyContent: "center", color: "#9CA3AF", fontSize: 13 }}>
                  No blood sugar readings in the last 14 days
                </div>
              ) : mounted ? (
                <div style={{ height: 200, width: "100%" }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={sugarChartData} margin={{ top: 10, right: 12, left: -18, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                      <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#9CA3AF" }} axisLine={{ stroke: "#E5E7EB" }} tickLine={false} />
                      <YAxis domain={["auto", "auto"]} tick={{ fontSize: 10, fill: "#9CA3AF" }} axisLine={{ stroke: "#E5E7EB" }} tickLine={false} />
                      <Tooltip
                        contentStyle={{ background: "#111827", borderRadius: 8, border: "none", color: "#fff", fontSize: 12 }}
                        formatter={(val: unknown) => [`${val} mg/dL`, "Blood Sugar"]}
                      />
                      <ReferenceLine y={140} stroke="#EF4444" strokeDasharray="3 3" label={{ value: "Max 140", fill: "#EF4444", fontSize: 9, position: "top" }} />
                      <ReferenceLine y={70} stroke="#F59E0B" strokeDasharray="3 3" label={{ value: "Min 70", fill: "#F59E0B", fontSize: 9, position: "bottom" }} />
                      <Line type="monotone" dataKey="sugar" stroke="#0D9488" strokeWidth={2.5} dot={{ r: 3.5, fill: "#0D9488" }} activeDot={{ r: 6 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div style={{ height: 200, background: "#F9FAFB", borderRadius: 8 }} />
              )}
            </div>

            {/* Blood Pressure Chart */}
            <div style={{
              background: "#fff", border: "1.5px solid #E5E7EB", borderRadius: 16,
              padding: "20px 22px", boxShadow: "0 1px 4px rgba(0,0,0,0.03)",
            }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                <div>
                  <h3 style={{ margin: "0 0 2px", fontSize: 14, fontWeight: 700, color: "#111827" }}>
                    Blood Pressure — Last 14 Days
                  </h3>
                  <div style={{ display: "flex", gap: 10, fontSize: 11, color: "#6B7280" }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#E11D48" }} /> Systolic
                    </span>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#2563EB" }} /> Diastolic
                    </span>
                  </div>
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, color: "#1E293B", background: "#F1F5F9", padding: "2px 8px", borderRadius: 6 }}>
                  mmHg
                </span>
              </div>

              {bpChartData.length === 0 ? (
                <div style={{ height: 180, display: "flex", alignItems: "center", justifyContent: "center", color: "#9CA3AF", fontSize: 13 }}>
                  No blood pressure readings in the last 14 days
                </div>
              ) : mounted ? (
                <div style={{ height: 200, width: "100%" }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={bpChartData} margin={{ top: 10, right: 12, left: -18, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                      <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#9CA3AF" }} axisLine={{ stroke: "#E5E7EB" }} tickLine={false} />
                      <YAxis domain={["auto", "auto"]} tick={{ fontSize: 10, fill: "#9CA3AF" }} axisLine={{ stroke: "#E5E7EB" }} tickLine={false} />
                      <Tooltip
                        contentStyle={{ background: "#111827", borderRadius: 8, border: "none", color: "#fff", fontSize: 12 }}
                      />
                      <ReferenceLine y={120} stroke="#E11D48" strokeDasharray="3 3" opacity={0.6} />
                      <ReferenceLine y={80} stroke="#2563EB" strokeDasharray="3 3" opacity={0.6} />
                      <Line type="monotone" dataKey="systolic" name="Systolic" stroke="#E11D48" strokeWidth={2.5} dot={{ r: 3.5, fill: "#E11D48" }} activeDot={{ r: 6 }} />
                      <Line type="monotone" dataKey="diastolic" name="Diastolic" stroke="#2563EB" strokeWidth={2.5} dot={{ r: 3.5, fill: "#2563EB" }} activeDot={{ r: 6 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div style={{ height: 200, background: "#F9FAFB", borderRadius: 8 }} />
              )}
            </div>
          </div>

          {/* Recent Readings Table / Card List (Last 10) */}
          <div style={{ background: "#fff", border: "1.5px solid #E5E7EB", borderRadius: 16, padding: "20px", boxShadow: "0 1px 3px rgba(0,0,0,0.03)" }}>
            <h3 style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 700, color: "#111827" }}>
              Recent Readings <span style={{ fontSize: 12, color: "#9CA3AF", fontWeight: 500 }}>({vitals.slice(0, 10).length})</span>
            </h3>

            {vitals.length === 0 ? (
              <p style={{ margin: 0, fontSize: 13, color: "#9CA3AF", fontStyle: "italic", textAlign: "center", padding: "16px 0" }}>
                No readings recorded yet.
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {vitals.slice(0, 10).map(v => {
                  const isSugar = v.type === "blood_sugar";
                  const status = isSugar
                    ? getBloodSugarStatus(v.value)
                    : getBloodPressureStatus(v.systolic, v.diastolic);
                  return (
                    <div
                      key={v.id}
                      style={{
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                        padding: "10px 14px", borderRadius: 10, background: "#F9FAFB", border: "1px solid #F3F4F6",
                        flexWrap: "wrap", gap: 10,
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <span style={{ fontSize: 18 }}>{isSugar ? "🩸" : "💓"}</span>
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>
                              {isSugar ? `${v.value} mg/dL` : `${v.systolic}/${v.diastolic} mmHg`}
                            </span>
                            <span style={{
                              padding: "2px 7px", borderRadius: 999, fontSize: 10, fontWeight: 700,
                              background: status.bg, color: status.color, border: `1px solid ${status.border}`,
                            }}>
                              {status.label}
                            </span>
                          </div>
                          <span style={{ fontSize: 11, color: "#9CA3AF" }}>
                            {isSugar ? "Blood Sugar" : "Blood Pressure"}
                            {v.notes && ` • "${v.notes}"`}
                          </span>
                        </div>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <span style={{ fontSize: 12, color: "#6B7280" }}>
                          {new Date(v.measuredAt).toLocaleString("en-IN", {
                            day: "numeric", month: "short", hour: "2-digit", minute: "2-digit"
                          })}
                        </span>
                        <button
                          onClick={() => handleDeleteVital(v.id)}
                          title="Delete entry"
                          style={{
                            width: 26, height: 26, borderRadius: 6, border: "1px solid #FEE2E2",
                            background: "#FFF5F5", cursor: "pointer", display: "flex", alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2.5">
                            <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                          </svg>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════════════════════
            MEDICATIONS SECTION
        ══════════════════════════════════════════════════════════════════════════ */}
        <section className="fade-up">
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
      </main>

      {/* ══════════════════════════════════════════════════════════════════════════
          MODAL: ADD BLOOD SUGAR
      ══════════════════════════════════════════════════════════════════════════ */}
      {showSugarModal && (
        <div style={modalOverlayStyle} onClick={() => setShowSugarModal(false)}>
          <div style={modalBoxStyle} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 20 }}>🩸</span>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "#111827" }}>Add Blood Sugar</h3>
              </div>
              <button
                onClick={() => setShowSugarModal(false)}
                style={{ border: "none", background: "none", fontSize: 18, cursor: "pointer", color: "#9CA3AF" }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveSugar} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
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
                  onClick={() => setShowSugarModal(false)}
                  style={{
                    flex: 1, padding: "10px", borderRadius: 9, border: "1.5px solid #E5E7EB",
                    background: "#fff", color: "#6B7280", fontWeight: 700, cursor: "pointer"
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!sugarVal}
                  style={{
                    flex: 2, padding: "10px", borderRadius: 9, border: "none",
                    background: sugarVal ? "#0D9488" : "#D1D5DB", color: "#fff",
                    fontWeight: 700, cursor: sugarVal ? "pointer" : "not-allowed"
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
      {showBPModal && (
        <div style={modalOverlayStyle} onClick={() => setShowBPModal(false)}>
          <div style={modalBoxStyle} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 20 }}>💓</span>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "#111827" }}>Add Blood Pressure</h3>
              </div>
              <button
                onClick={() => setShowBPModal(false)}
                style={{ border: "none", background: "none", fontSize: 18, cursor: "pointer", color: "#9CA3AF" }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveBP} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
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
                  onClick={() => setShowBPModal(false)}
                  style={{
                    flex: 1, padding: "10px", borderRadius: 9, border: "1.5px solid #E5E7EB",
                    background: "#fff", color: "#6B7280", fontWeight: 700, cursor: "pointer"
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!bpSys || !bpDia}
                  style={{
                    flex: 2, padding: "10px", borderRadius: 9, border: "none",
                    background: bpSys && bpDia ? "#0D9488" : "#D1D5DB", color: "#fff",
                    fontWeight: 700, cursor: bpSys && bpDia ? "pointer" : "not-allowed"
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

              {/* Vitals indicators */}
              <div style={{ background: "#F0FDFA", border: "1.5px solid #99F6E4", borderRadius: 10, padding: "12px 14px", marginTop: 4 }}>
                <p style={{ ...lblStyle, color: "#0D9488", marginBottom: 8 }}>Vitals Monitoring Flags</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, fontWeight: 600, color: "#111827" }}>
                    <input
                      type="checkbox"
                      checked={editDiabetes}
                      onChange={e => setEditDiabetes(e.target.checked)}
                      style={{ width: 16, height: 16, accentColor: "#0D9488" }}
                    />
                    Has Diabetes (Track Blood Sugar)
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, fontWeight: 600, color: "#111827" }}>
                    <input
                      type="checkbox"
                      checked={editHypertension}
                      onChange={e => setEditHypertension(e.target.checked)}
                      style={{ width: 16, height: 16, accentColor: "#0D9488" }}
                    />
                    Has Hypertension (Track Blood Pressure)
                  </label>
                </div>
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
    </div>
  );
}
