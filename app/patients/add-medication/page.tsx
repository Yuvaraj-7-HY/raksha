"use client";

import { useEffect, useState, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { getPatients, addMedication } from "@/lib/storage";
import { parseOcrText } from "@/lib/medicineDatabase";
import type { Patient } from "@/types";

const UNITS = ["mg", "mcg", "g", "ml", "IU", "units", "puffs", "drops", "tablet(s)", "capsule(s)", "patch"];
const SCHEDULES = [
  "Once daily (morning)",
  "Once daily (evening)",
  "Twice daily",
  "Three times daily",
  "Every 8 hours",
  "Every 12 hours",
  "With meals",
  "At bedtime",
  "Weekly",
  "As needed",
];

function AddMedicationContent() {
  const router = useRouter();
  const params = useSearchParams();

  const paramPatientId = params.get("patientId") ?? "";
  const paramName = params.get("name") ?? "";
  const paramDosage = params.get("dosage") ?? "";
  const paramUnit = params.get("unit") ?? "";
  const paramSchedule = params.get("schedule") ?? params.get("frequency") ?? "";
  const paramNotes = params.get("notes") ?? params.get("instructions") ?? "";
  const fromScan = params.get("from");

  const galleryInputRef = useRef<HTMLInputElement>(null);
  const [isScanningGallery, setIsScanningGallery] = useState(false);
  const [scanSource, setScanSource] = useState<string | null>(fromScan);

  const [patients, setPatients] = useState<Patient[]>([]);
  const [patientId, setPatientId] = useState(paramPatientId);
  const [medName, setMedName] = useState(paramName);
  const [dosage, setDosage] = useState("");
  const [unit, setUnit] = useState("mg");
  const [schedule, setSchedule] = useState("Once daily (morning)");
  const [notes, setNotes] = useState(paramNotes);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (fromScan) setScanSource(fromScan);
  }, [fromScan]);

  const handleGalleryFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsScanningGallery(true);
    setError("");

    try {
      // Smooth brief animation to simulate AI analysis
      await new Promise(r => setTimeout(r, 900));

      const ocrText = file.name.replace(/[_\-.]/g, " ");
      const result = parseOcrText(ocrText);

      setMedName(result.name);
      if (result.dosage) {
        const match = result.dosage.match(/^(\d+(?:\.\d+)?)\s*([a-zA-Z]+)?$/);
        if (match) {
          setDosage(match[1]);
          if (match[2] && UNITS.includes(match[2].toLowerCase())) {
            setUnit(match[2].toLowerCase());
          }
        } else {
          setDosage(result.dosage);
        }
      }
      if (result.frequency) {
        const matched = SCHEDULES.find(s => s.toLowerCase().includes(result.frequency.toLowerCase()));
        if (matched) setSchedule(matched);
        else setSchedule(result.frequency);
      }
      if (result.instructions) {
        setNotes(result.instructions);
      }
      setScanSource("gallery");
    } finally {
      setIsScanningGallery(false);
      e.target.value = "";
    }
  };

  useEffect(() => {
    const list = getPatients();
    setPatients(list);
    if (!patientId && list.length > 0) {
      if (paramPatientId) {
        setPatientId(paramPatientId);
      } else {
        setPatientId(list[0].id);
      }
    }
    setLoading(false);
  }, [paramPatientId]);

  // Parse dosage string (e.g. "500 mg", "500mg", "10")
  useEffect(() => {
    if (paramDosage) {
      const match = paramDosage.match(/^(\d+(?:\.\d+)?)\s*([a-zA-Z]+)?$/);
      if (match) {
        setDosage(match[1]);
        if (match[2] && UNITS.includes(match[2].toLowerCase())) {
          setUnit(match[2].toLowerCase());
        }
      } else {
        setDosage(paramDosage);
      }
    }
    if (paramUnit && UNITS.includes(paramUnit)) {
      setUnit(paramUnit);
    }
    if (paramSchedule) {
      const matchedSchedule = SCHEDULES.find(s => s.toLowerCase().includes(paramSchedule.toLowerCase()));
      if (matchedSchedule) setSchedule(matchedSchedule);
      else setSchedule(paramSchedule);
    }
    if (paramName) {
      setMedName(paramName);
    }
    if (paramNotes) {
      setNotes(paramNotes);
    }
  }, [paramDosage, paramUnit, paramSchedule, paramName, paramNotes]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!patientId) { setError("Please select a patient."); return; }
    if (!medName.trim()) { setError("Medication name is required."); return; }
    setSaving(true);
    addMedication({
      patientId,
      name: medName.trim(),
      dosage: dosage.trim(),
      unit,
      schedule,
      notes: notes.trim(),
    });
    sessionStorage.setItem("raksha_toast", medName.trim() + " added successfully!");
    router.push("/patients/" + patientId);
  }

  const selectedPatient = patients.find(p => p.id === patientId);

  const inp: React.CSSProperties = {
    width: "100%", padding: "11px 14px", borderRadius: 10,
    border: "1.5px solid #E5E7EB", fontSize: 14, outline: "none",
    color: "#111827", background: "#fff", transition: "border-color 0.15s", fontFamily: "inherit",
  };
  const lbl: React.CSSProperties = {
    display: "block", fontSize: 12, fontWeight: 700, color: "#374151",
    marginBottom: 6, letterSpacing: "0.04em", textTransform: "uppercase",
  };

  const prescriptionLink = "/medicines/add/scan-prescription?autoCamera=true" + (patientId ? "&patientId=" + patientId : "");

  return (
    <div style={{ minHeight: "100vh", background: "#F9FAFB", fontFamily: "Inter,ui-sans-serif,system-ui,sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        * { box-sizing:border-box; }
        input:focus, select:focus, textarea:focus { border-color:#0D9488 !important; box-shadow:0 0 0 3px rgba(13,148,136,0.1); }
        @keyframes fadeUp { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        @keyframes spin { to { transform: rotate(360deg); } }
        .fade-up { animation:fadeUp 0.3s ease-out both; }
        select { appearance:none; }
        .scan-card:hover { border-color:#0D9488 !important; background:#F0FDFA !important; transform:translateY(-1px); }
      `}</style>

      {/* Hidden file input for Add from Gallery */}
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        onChange={handleGalleryFile}
        style={{ display: "none" }}
      />

      {/* Header */}
      <header style={{
        background: "#fff", borderBottom: "1px solid #E5E7EB", padding: "0 32px",
        height: 60, display: "flex", alignItems: "center", gap: 14,
        position: "sticky", top: 0, zIndex: 30, boxShadow: "0 1px 3px rgba(0,0,0,0.04)"
      }}>
        <Link href={patientId ? "/patients/" + patientId : "/patients"} style={{
          width: 34, height: 34, borderRadius: 9, border: "1px solid #E5E7EB",
          background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none"
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
        </Link>
        <div style={{ width: 1, height: 20, background: "#E5E7EB" }} />
        <Link href="/patients" style={{ fontSize: 13, color: "#6B7280", textDecoration: "none" }}>Patients</Link>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#D1D5DB" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
        <span style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>Add Medication</span>
      </header>

      <main style={{ maxWidth: 640, margin: "36px auto", padding: "0 24px" }}>
        <div style={{
          background: "#fff", border: "1px solid #E5E7EB", borderRadius: 18,
          padding: "32px 36px", boxShadow: "0 2px 8px rgba(0,0,0,0.06)"
        }} className="fade-up">

          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20 }}>
            <div>
              <h1 style={{ margin: "0 0 6px", fontSize: 22, fontWeight: 800, color: "#111827", letterSpacing: "-0.02em" }}>Add Medication</h1>
              <p style={{ margin: 0, fontSize: 13, color: "#6B7280" }}>Add from gallery, take a photo, or fill details manually.</p>
            </div>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: "#CCFBF1", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0D9488" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            </div>
          </div>

          {/* Banner if auto-filled from scanner or gallery */}
          {scanSource && (
            <div style={{
              margin: "0 0 22px", padding: "12px 16px", borderRadius: 12,
              background: "#F0FDF4", border: "1.5px solid #86EFAC",
              display: "flex", alignItems: "center", gap: 12
            }}>
              <div style={{
                width: 34, height: 34, borderRadius: "50%", background: "#DCFCE7",
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0
              }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "#15803D" }}>
                  Auto-filled from {scanSource === "gallery" ? "Gallery Image" : scanSource === "barcode" ? "Barcode Scan" : "Prescription Photo"}
                </p>
                <p style={{ margin: 0, fontSize: 11, color: "#166534" }}>
                  Verify the patient and medication details below before saving.
                </p>
              </div>
            </div>
          )}

          {/* Quick Scanner Shortcuts */}
          <div style={{ marginBottom: 24 }}>
            <p style={{ ...lbl, color: "#6B7280", marginBottom: 10 }}>Scan & Auto-Fill Options</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {/* Option 1: Add from Gallery */}
              <button
                type="button"
                onClick={() => galleryInputRef.current?.click()}
                disabled={isScanningGallery}
                className="scan-card"
                style={{
                  display: "flex", alignItems: "center", gap: 12, padding: "12px 14px",
                  borderRadius: 12, border: "1.5px solid #E5E7EB", background: "#F9FAFB",
                  textDecoration: "none", color: "#111827", transition: "all 0.15s",
                  cursor: isScanningGallery ? "wait" : "pointer",
                  width: "100%", textAlign: "left", fontFamily: "inherit"
                }}
              >
                <div style={{
                  width: 36, height: 36, borderRadius: 9, background: "#EEF2FF",
                  display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0
                }}>
                  {isScanningGallery ? (
                    <div style={{
                      width: 16, height: 16, border: "2px solid #4F46E5",
                      borderTopColor: "transparent", borderRadius: "50%",
                      animation: "spin 0.8s linear infinite"
                    }} />
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4F46E5" strokeWidth="2">
                      <rect x="3" y="3" width="18" height="18" rx="2"/>
                      <circle cx="8.5" cy="8.5" r="1.5"/>
                      <polyline points="21 15 16 10 5 21"/>
                    </svg>
                  )}
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>
                    {isScanningGallery ? "Analyzing..." : "Add from Gallery"}
                  </div>
                  <div style={{ fontSize: 11, color: "#6B7280" }}>
                    {isScanningGallery ? "Reading label details" : "Photo library or file"}
                  </div>
                </div>
              </button>

              {/* Option 2: Take Photo */}
              <Link href={prescriptionLink} className="scan-card" style={{
                display: "flex", alignItems: "center", gap: 12, padding: "12px 14px",
                borderRadius: 12, border: "1.5px solid #E5E7EB", background: "#F9FAFB",
                textDecoration: "none", color: "#111827", transition: "all 0.15s"
              }}>
                <div style={{ width: 36, height: 36, borderRadius: 9, background: "#FEF3C7", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>Take Photo</div>
                  <div style={{ fontSize: 11, color: "#6B7280" }}>Camera & AI Reader</div>
                </div>
              </Link>
            </div>
          </div>

          {loading ? (
            <div style={{ height: 120, borderRadius: 12, background: "#F3F4F6", animation: "pulse 1.5s ease-in-out infinite" }} />
          ) : patients.length === 0 ? (
            <div style={{ textAlign: "center", padding: "32px 0" }}>
              <p style={{ fontSize: 14, color: "#6B7280", marginBottom: 16 }}>No patients registered yet. Add a patient first.</p>
              <Link href="/patients/new" style={{
                padding: "10px 20px", borderRadius: 9,
                background: "#0D9488", color: "#fff", textDecoration: "none", fontSize: 14, fontWeight: 700
              }}>
                + Add Patient
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              {error && (
                <div style={{
                  padding: "10px 14px", borderRadius: 9, background: "#FEE2E2",
                  color: "#DC2626", fontSize: 13, fontWeight: 600
                }}>{error}</div>
              )}

              {/* Step 1: Patient selection */}
              <div style={{
                padding: "18px 20px", borderRadius: 14, background: "#F0FDFA",
                border: "1.5px solid #99F6E4"
              }}>
                <label style={{ ...lbl, color: "#0D9488", marginBottom: 10 }}>Patient Assignment *</label>
                <select
                  value={patientId}
                  onChange={e => { setPatientId(e.target.value); setError(""); }}
                  style={{
                    ...inp, cursor: "pointer",
                    background: "#fff url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%236B7280' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E\") no-repeat right 12px center"
                  }}
                >
                  <option value="">— Select Patient —</option>
                  {patients.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name}{p.age ? ` (${p.age} yrs)` : ""}
                    </option>
                  ))}
                </select>

                {selectedPatient && (
                  <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 10, background: "#fff", padding: "8px 12px", borderRadius: 8, border: "1px solid #CCFBF1" }}>
                    <div style={{
                      width: 28, height: 28, borderRadius: 7, background: "#CCFBF1",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 11, fontWeight: 800, color: "#0D9488"
                    }}>
                      {selectedPatient.name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <span style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>{selectedPatient.name}</span>
                      {selectedPatient.conditions.length > 0 && (
                        <span style={{ fontSize: 11, color: "#6B7280", marginLeft: 8 }}>
                          {selectedPatient.conditions.join(" · ")}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Step 2: Medication details */}
              <div style={{ padding: "18px 20px", borderRadius: 14, background: "#F9FAFB", border: "1.5px solid #E5E7EB" }}>
                <p style={{ ...lbl, color: "#374151", marginBottom: 16 }}>Medication Details</p>

                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  <div>
                    <label style={lbl}>Medicine Name *</label>
                    <input
                      value={medName}
                      onChange={e => { setMedName(e.target.value); setError(""); }}
                      placeholder="e.g. Metformin, Amlodipine"
                      style={inp}
                    />
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <div>
                      <label style={lbl}>Dosage</label>
                      <input
                        value={dosage}
                        onChange={e => setDosage(e.target.value)}
                        placeholder="e.g. 500"
                        style={inp}
                      />
                    </div>
                    <div>
                      <label style={lbl}>Unit</label>
                      <select
                        value={unit}
                        onChange={e => setUnit(e.target.value)}
                        style={{
                          ...inp, cursor: "pointer",
                          background: "#fff url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%236B7280' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E\") no-repeat right 12px center"
                        }}
                      >
                        {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label style={lbl}>Schedule / Frequency</label>
                    <select
                      value={schedule}
                      onChange={e => setSchedule(e.target.value)}
                      style={{
                        ...inp, cursor: "pointer",
                        background: "#fff url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%236B7280' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E\") no-repeat right 12px center"
                      }}
                    >
                      {SCHEDULES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>

                  <div>
                    <label style={lbl}>Instructions & Notes (optional)</label>
                    <textarea
                      value={notes}
                      onChange={e => setNotes(e.target.value)}
                      placeholder="e.g. Take with food, drink full glass of water, avoid grapefruit…"
                      rows={3}
                      style={{ ...inp, resize: "vertical", lineHeight: 1.6 }}
                    />
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div style={{ display: "flex", gap: 10 }}>
                <Link
                  href={patientId ? "/patients/" + patientId : "/patients"}
                  style={{
                    flex: 1, padding: "12px", borderRadius: 10,
                    border: "1.5px solid #E5E7EB", background: "#fff", color: "#6B7280",
                    textDecoration: "none", fontSize: 14, fontWeight: 700, textAlign: "center"
                  }}
                >
                  Cancel
                </Link>
                <button
                  type="submit"
                  disabled={saving || !patientId || !medName.trim()}
                  style={{
                    flex: 2, padding: "12px", borderRadius: 10, border: "none",
                    background: (patientId && medName.trim()) ? "#0D9488" : "#D1D5DB",
                    color: "#fff", fontSize: 14, fontWeight: 700,
                    cursor: (patientId && medName.trim()) ? "pointer" : "not-allowed",
                    transition: "background 0.15s"
                  }}
                >
                  {saving ? "Saving…" : "Save Medication"}
                </button>
              </div>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}

export default function AddMedicationPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: "100vh", background: "#F9FAFB" }} />}>
      <AddMedicationContent />
    </Suspense>
  );
}
