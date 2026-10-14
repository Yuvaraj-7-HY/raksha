// app/patients/page.tsx
"use client";

import { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import {
  getMedications,
  deleteMedication,
} from "@/lib/storage";
import type { Medication } from "@/types";
import {
  SendSmsModal,
  CallCaregiverModal,
  LastSmsNote,
} from "./components/CommunicationModals";
import { GlobalAlertsModal } from "./components/GlobalAlertsModal";
import type { ConditionType } from "@/types/conditions";

interface DynamicPatient {
  id: string;
  name: string;
  phone: string;
  family_phone?: string;
  conditions: ConditionType[];
  last_contact_status: string;
  recheck_pending: boolean;
  open_alerts_count: number;
  urgent_alerts_count: number;
  warning_alerts_count: number;
  status: "red" | "amber" | "green";
  latest_vitals_summary: string;
  medications?: string;
  notes?: string;
}

const CONDITION_BADGE_STYLES: Record<ConditionType, { bg: string; color: string; border: string }> = {
  diabetes: { bg: "#BAE6FD", color: "#0369A1", border: "#7DD3FC" },
  hypertension: { bg: "#FECDD3", color: "#BE123C", border: "#FDA4AF" },
  dementia: { bg: "#FEF08A", color: "#854D0E", border: "#FDE047" },
  depression: { bg: "#DDD6FE", color: "#6D28D9", border: "#C4B5FD" },
};

function Skeleton() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {[1, 2, 3, 4].map((i) => (
        <div
          key={i}
          style={{
            height: 96,
            borderRadius: 16,
            background: "#D8EEFD",
            border: "1.5px solid #90CDF4",
            animation: "pulse 1.5s ease-in-out infinite",
          }}
        />
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
  const [patients, setPatients] = useState<DynamicPatient[]>([]);
  const [medications, setMedications] = useState<Medication[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedCondition, setSelectedCondition] = useState<string>("all");
  const [selectedSeverity, setSelectedSeverity] = useState<string>("all");
  const [toast, setToast] = useState<string | null>(null);

  // Inactivity check running state
  const [runningInactivityCheck, setRunningInactivityCheck] = useState(false);

  // Global alerts drawer modal
  const [showAlertsModal, setShowAlertsModal] = useState(false);
  const [totalOpenAlerts, setTotalOpenAlerts] = useState(0);

  // Communication Modals
  const [smsModalPatient, setSmsModalPatient] = useState<any | null>(null);
  const [callModalPatient, setCallModalPatient] = useState<any | null>(null);

  const fetchPatients = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/patients");
      const data = await res.json();
      if (data.patients) {
        setPatients(data.patients);
        const openSum = data.patients.reduce(
          (acc: number, p: DynamicPatient) => acc + (p.open_alerts_count || 0),
          0
        );
        setTotalOpenAlerts(openSum);
      }
      setMedications(getMedications());
    } catch (err) {
      console.error("Failed to load patients:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPatients();
  }, []);

  const handleRunInactivityCheck = async () => {
    try {
      setRunningInactivityCheck(true);
      const secret = "2ea1c4261d21c5a1ecfac162fd6c141cbc2fd30341508a9dce9f9ed241674b82";
      const res = await fetch(`/api/cron/condition-check?secret=${secret}`);
      const data = await res.json();

      if (data.success) {
        setToast(`Checked ${data.patients_evaluated} patients. ${data.alerts_created_count} new inactivity alerts.`);
        await fetchPatients();
      } else {
        setToast("Inactivity check completed.");
      }
      setTimeout(() => setToast(null), 4000);
    } catch (err) {
      console.error("Inactivity check error:", err);
      setToast("Error running inactivity check.");
      setTimeout(() => setToast(null), 3000);
    } finally {
      setRunningInactivityCheck(false);
    }
  };

  function handleDeleteMed(medId: string, medName: string) {
    if (!confirm(`Delete medication "${medName}"?`)) return;
    deleteMedication(medId);
    setMedications(getMedications());
    setToast(`Medication "${medName}" deleted.`);
    setTimeout(() => setToast(null), 3000);
  }

  // Filtered patients
  const filteredPatients = patients.filter((p) => {
    // Condition filter
    if (selectedCondition !== "all" && !p.conditions.includes(selectedCondition as ConditionType)) {
      return false;
    }
    // Severity filter
    if (selectedSeverity !== "all" && p.status !== selectedSeverity) {
      return false;
    }
    // Search filter
    if (search) {
      const q = search.toLowerCase();
      const matchName = p.name.toLowerCase().includes(q);
      const matchPhone = p.phone.includes(q);
      const matchCond = p.conditions.some((c) => c.toLowerCase().includes(q));
      return matchName || matchPhone || matchCond;
    }
    return true;
  });

  const todayStr = new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(180deg, #BAE6FD 0%, #D4EEFD 40%, #C3E5FC 100%)", color: "#083457", fontFamily: "Inter,ui-sans-serif,system-ui,sans-serif" }}>
      {/* Toast */}
      {toast && (
        <div style={{
          position: "fixed",
          bottom: 28,
          right: 28,
          zIndex: 99999,
          background: "#083457",
          color: "#E0F2FE",
          border: "1.5px solid #1DA1F2",
          padding: "12px 20px",
          borderRadius: 12,
          fontSize: 13,
          fontWeight: 700,
          boxShadow: "0 8px 24px rgba(8, 52, 87, 0.25)",
        }}>
          ✓ {toast}
        </div>
      )}

      {/* Header - Vibrant Twitter Sky Blue */}
      <header style={{
        background: "linear-gradient(135deg, #1DA1F2 0%, #0C85D0 100%)",
        borderBottom: "2px solid #0A72B3",
        padding: "0 32px",
        height: 68,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        position: "sticky",
        top: 0,
        zIndex: 30,
        boxShadow: "0 4px 20px rgba(12, 133, 208, 0.25)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{
            width: 42,
            height: 42,
            borderRadius: 12,
            background: "#083457",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 2px 10px rgba(8, 52, 87, 0.3)",
          }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1DA1F2" strokeWidth="2.6">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <h1 style={{ margin: 0, fontSize: 19, fontWeight: 800, color: "#FFFFFF", letterSpacing: "-0.02em" }}>
                Raksha Care Platform
              </h1>
              <span style={{ fontSize: 11, background: "#083457", color: "#BAE6FD", border: "1px solid rgba(186, 230, 253, 0.4)", padding: "2px 8px", borderRadius: 6, fontWeight: 700 }}>
                Condition-Aware
              </span>
            </div>
            <p style={{ margin: 0, fontSize: 11, color: "#E0F2FE", fontWeight: 500 }}>{todayStr} · Asia/Kolkata (IST)</p>
          </div>
        </div>

        {/* Header Action Buttons */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          {/* Landing Link */}
          <Link
            href="/"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "8px 14px",
              borderRadius: 10,
              background: "rgba(8, 52, 87, 0.3)",
              border: "1px solid rgba(224, 242, 254, 0.4)",
              color: "#FFFFFF",
              fontSize: 12,
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            🏠 Home
          </Link>

          {/* Demo Call Shortcut */}
          <Link
            href="/demo-call"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "8px 14px",
              borderRadius: 10,
              background: "#083457",
              border: "1px solid #1DA1F2",
              color: "#BAE6FD",
              fontSize: 12,
              fontWeight: 700,
              textDecoration: "none",
            }}
          >
            🎙️ Voice Demo
          </Link>

          {/* Active Alerts Button */}
          <button
            onClick={() => setShowAlertsModal(true)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 14px",
              borderRadius: 10,
              background: totalOpenAlerts > 0 ? "#FEE2E2" : "#D1FAE5",
              border: `1.5px solid ${totalOpenAlerts > 0 ? "#FCA5A5" : "#6EE7B7"}`,
              color: totalOpenAlerts > 0 ? "#B91C1C" : "#065F46",
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            <span>🔔 Alerts</span>
            <span style={{
              background: totalOpenAlerts > 0 ? "#DC2626" : "#059669",
              color: "#fff",
              padding: "1px 7px",
              borderRadius: 999,
              fontSize: 11,
              fontWeight: 800,
            }}>
              {totalOpenAlerts}
            </span>
          </button>

          {/* Inactivity Check Trigger Button */}
          <button
            onClick={handleRunInactivityCheck}
            disabled={runningInactivityCheck}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "8px 14px",
              borderRadius: 10,
              border: "1px solid rgba(255, 255, 255, 0.4)",
              background: "rgba(255, 255, 255, 0.2)",
              color: "#FFFFFF",
              fontSize: 13,
              fontWeight: 600,
              cursor: runningInactivityCheck ? "not-allowed" : "pointer",
            }}
          >
            {runningInactivityCheck ? "Running Check..." : "⏱️ Inactivity Check"}
          </button>

          <Link href="/patients/new" style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "8px 16px",
            borderRadius: 10,
            background: "#083457",
            color: "#FFFFFF",
            border: "1.5px solid #1DA1F2",
            textDecoration: "none",
            fontSize: 13,
            fontWeight: 700,
            boxShadow: "0 3px 10px rgba(8, 52, 87, 0.3)",
          }}>
            + Add Patient
          </Link>
        </div>
      </header>

      {/* Subnav & Filters */}
      <div style={{ maxWidth: 1240, margin: "0 auto", padding: "28px 24px" }}>
        {/* Navigation Tabs */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div style={{ display: "flex", gap: 6, background: "#BAE6FD", border: "1.5px solid #7DD3FC", padding: 4, borderRadius: 12 }}>
            <button
              onClick={() => setTab("patients")}
              style={{
                padding: "8px 18px",
                borderRadius: 9,
                border: "none",
                background: tab === "patients" ? "#1DA1F2" : "transparent",
                color: tab === "patients" ? "#FFFFFF" : "#083457",
                fontSize: 13,
                fontWeight: 700,
                cursor: "pointer",
                boxShadow: tab === "patients" ? "0 2px 8px rgba(29,161,242,0.35)" : "none",
                transition: "all 0.15s ease",
              }}
            >
              Patients ({patients.length})
            </button>
            <button
              onClick={() => setTab("medications")}
              style={{
                padding: "8px 18px",
                borderRadius: 9,
                border: "none",
                background: tab === "medications" ? "#1DA1F2" : "transparent",
                color: tab === "medications" ? "#FFFFFF" : "#083457",
                fontSize: 13,
                fontWeight: 700,
                cursor: "pointer",
                boxShadow: tab === "medications" ? "0 2px 8px rgba(29,161,242,0.35)" : "none",
                transition: "all 0.15s ease",
              }}
            >
              Medications Hub ({medications.length})
            </button>
          </div>
        </div>

        {tab === "patients" && (
          <>
            {/* Filter Bar: Condition Chips + Severity + Search */}
            <div style={{
              background: "#E0F2FE",
              border: "1.5px solid #7DD3FC",
              borderRadius: 16,
              padding: "16px 20px",
              marginBottom: 24,
              display: "flex",
              flexDirection: "column",
              gap: 14,
              boxShadow: "0 4px 16px rgba(12, 133, 208, 0.12)",
            }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
                {/* Condition filter chips */}
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#083457", textTransform: "uppercase" }}>
                    Condition:
                  </span>
                  {[
                    { id: "all", label: "All" },
                    { id: "diabetes", label: "Diabetes" },
                    { id: "hypertension", label: "Hypertension (BP)" },
                    { id: "dementia", label: "Dementia" },
                    { id: "depression", label: "Depression" },
                  ].map((item) => (
                    <button
                      key={item.id}
                      onClick={() => setSelectedCondition(item.id)}
                      style={{
                        padding: "6px 12px",
                        borderRadius: 8,
                        border: `1.5px solid ${selectedCondition === item.id ? "#0C85D0" : "#7DD3FC"}`,
                        background: selectedCondition === item.id ? "#1DA1F2" : "#BAE6FD",
                        color: selectedCondition === item.id ? "#FFFFFF" : "#083457",
                        fontSize: 12,
                        fontWeight: selectedCondition === item.id ? 700 : 600,
                        cursor: "pointer",
                        transition: "all 0.15s ease",
                      }}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>

                {/* Severity status filter */}
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#083457", textTransform: "uppercase" }}>
                    Status:
                  </span>
                  {[
                    { id: "all", label: "All Statuses", color: "#083457" },
                    { id: "red", label: "Urgent (Red)", color: "#B91C1C" },
                    { id: "amber", label: "Warning (Amber)", color: "#B45309" },
                    { id: "green", label: "Normal (Green)", color: "#047857" },
                  ].map((s) => (
                    <button
                      key={s.id}
                      onClick={() => setSelectedSeverity(s.id)}
                      style={{
                        padding: "6px 10px",
                        borderRadius: 8,
                        border: `1.5px solid ${selectedSeverity === s.id ? s.color : "#7DD3FC"}`,
                        background: selectedSeverity === s.id ? "#BAE6FD" : "#D4EEFD",
                        color: selectedSeverity === s.id ? s.color : "#083457",
                        fontSize: 12,
                        fontWeight: selectedSeverity === s.id ? 700 : 600,
                        cursor: "pointer",
                        transition: "all 0.15s ease",
                      }}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Search input */}
              <div style={{ position: "relative" }}>
                <input
                  type="text"
                  placeholder="Search by patient name, phone number, or condition tag..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "10px 14px 10px 38px",
                    borderRadius: 10,
                    border: "1.5px solid #7DD3FC",
                    fontSize: 13,
                    outline: "none",
                    background: "#F0F9FF",
                    color: "#083457",
                    boxSizing: "border-box",
                  }}
                />
                <span style={{ position: "absolute", left: 14, top: 11, color: "#0C85D0", fontSize: 14 }}>
                  🔍
                </span>
              </div>
            </div>

            {/* Patient Cards / Rows */}
            {loading ? (
              <Skeleton />
            ) : filteredPatients.length === 0 ? (
              <div style={{
                background: "#EDF7FE",
                border: "1.5px dashed #7DD3FC",
                borderRadius: 16,
                padding: "64px 24px",
                textAlign: "center",
              }}>
                <p style={{ margin: "0 0 6px", fontSize: 16, fontWeight: 700, color: "#083457" }}>
                  No matching patients found
                </p>
                <p style={{ margin: "0 0 20px", fontSize: 13, color: "#12578A" }}>
                  Try resetting filters or adding a new patient.
                </p>
                <button
                  onClick={() => {
                    setSelectedCondition("all");
                    setSelectedSeverity("all");
                    setSearch("");
                  }}
                  style={{
                    padding: "8px 16px",
                    borderRadius: 8,
                    background: "#1DA1F2",
                    color: "#fff",
                    border: "none",
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  Clear Filters
                </button>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {filteredPatients.map((p) => {
                  const statusDotColor =
                    p.status === "red" ? "#E11D48" : p.status === "amber" ? "#D97706" : "#059669";
                  const statusBg =
                    p.status === "red" ? "#FFE4E6" : p.status === "amber" ? "#FEF3C7" : "#D1FAE5";

                  return (
                    <div
                      key={p.id}
                      style={{
                        background: "#EDF7FE",
                        border: "1.5px solid #7DD3FC",
                        borderRadius: 16,
                        padding: "18px 22px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 20,
                        transition: "all 0.15s ease",
                        boxShadow: "0 2px 10px rgba(12, 133, 208, 0.08)",
                      }}
                    >
                      {/* Left: Patient Details */}
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                          {/* Severity Indicator Dot */}
                          <span
                            title={`Status: ${p.status.toUpperCase()}`}
                            style={{
                              width: 10,
                              height: 10,
                              borderRadius: "50%",
                              background: statusDotColor,
                              boxShadow: `0 0 0 3px ${statusBg}`,
                            }}
                          />
                          <Link
                            href={`/patients/${p.id}`}
                            style={{
                              fontSize: 16,
                              fontWeight: 800,
                              color: "#083457",
                              textDecoration: "none",
                            }}
                          >
                            {p.name}
                          </Link>

                          {/* Adherence / Last contact pill */}
                          <span style={{
                            fontSize: 11,
                            fontWeight: 700,
                            padding: "3px 9px",
                            borderRadius: 6,
                            background: p.recheck_pending
                              ? "#FEF3C7"
                              : p.last_contact_status === "yes"
                              ? "#D1FAE5"
                              : p.last_contact_status === "no"
                              ? "#FFE4E6"
                              : "#BAE6FD",
                            color: p.recheck_pending
                              ? "#B45309"
                              : p.last_contact_status === "yes"
                              ? "#065F46"
                              : p.last_contact_status === "no"
                              ? "#9F1239"
                              : "#083457",
                            border: `1px solid ${
                              p.recheck_pending
                                ? "#FDE68A"
                                : p.last_contact_status === "yes"
                                ? "#6EE7B7"
                                : p.last_contact_status === "no"
                                ? "#FECDD3"
                                : "#7DD3FC"
                            }`,
                          }}>
                            {p.recheck_pending
                              ? "Re-check Pending"
                              : p.last_contact_status === "yes"
                              ? "Adherent"
                              : p.last_contact_status === "no"
                              ? "Missed Dose"
                              : "No Call Today"}
                          </span>
                        </div>

                        {/* Condition chips */}
                        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
                          {p.conditions && p.conditions.length > 0 ? (
                            p.conditions.map((cond) => {
                              const s = CONDITION_BADGE_STYLES[cond] || {
                                bg: "#BAE6FD",
                                color: "#083457",
                                border: "#7DD3FC",
                              };
                              return (
                                <span
                                  key={cond}
                                  style={{
                                    fontSize: 11,
                                    fontWeight: 700,
                                    background: s.bg,
                                    color: s.color,
                                    border: `1px solid ${s.border}`,
                                    padding: "2px 8px",
                                    borderRadius: 6,
                                    textTransform: "capitalize",
                                  }}
                                >
                                  {cond}
                                </span>
                              );
                            })
                          ) : (
                            <span style={{ fontSize: 11, color: "#12578A" }}>No active conditions assigned</span>
                          )}
                        </div>

                        {/* Vitals Summary & Phone */}
                        <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 12, color: "#12578A" }}>
                          <span>📞 {p.phone}</span>
                          <span>•</span>
                          <span style={{ fontWeight: 700, color: "#083457" }}>
                            {p.latest_vitals_summary}
                          </span>
                        </div>
                      </div>

                      {/* Right: Alert status + Actions */}
                      <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
                        {p.open_alerts_count > 0 ? (
                          <span style={{
                            padding: "6px 12px",
                            borderRadius: 8,
                            fontSize: 12,
                            fontWeight: 700,
                            background: p.urgent_alerts_count > 0 ? "#FEE2E2" : "#FEF3C7",
                            color: p.urgent_alerts_count > 0 ? "#B91C1C" : "#B45309",
                            border: `1px solid ${p.urgent_alerts_count > 0 ? "#FCA5A5" : "#FDE68A"}`,
                          }}>
                            {p.open_alerts_count} Open Alert{p.open_alerts_count > 1 ? "s" : ""}
                          </span>
                        ) : (
                          <span style={{ fontSize: 12, color: "#059669", fontWeight: 700 }}>
                            ✓ All Normal
                          </span>
                        )}

                        <Link
                          href={`/patients/${p.id}`}
                          style={{
                            padding: "8px 16px",
                            borderRadius: 10,
                            background: "#1DA1F2",
                            color: "#fff",
                            textDecoration: "none",
                            fontSize: 13,
                            fontWeight: 700,
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                            boxShadow: "0 2px 10px rgba(29, 161, 242, 0.35)",
                          }}
                        >
                          View Profile →
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* Medications tab view */}
        {tab === "medications" && (
          <div style={{ background: "#EDF7FE", border: "1.5px solid #7DD3FC", borderRadius: 16, padding: "24px", boxShadow: "0 4px 16px rgba(12, 133, 208, 0.12)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: "#083457" }}>
                Active Medication Schedules
              </h2>
              <Link
                href="/patients/add-medication"
                style={{
                  padding: "8px 14px",
                  borderRadius: 8,
                  background: "#1DA1F2",
                  color: "#fff",
                  fontSize: 12,
                  fontWeight: 700,
                  textDecoration: "none",
                  boxShadow: "0 2px 8px rgba(29,161,242,0.35)",
                }}
              >
                + Add Medication
              </Link>
            </div>

            {medications.length === 0 ? (
              <p style={{ color: "#12578A", textAlign: "center", padding: 32 }}>No medications added yet.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {medications.map((m) => (
                  <div
                    key={m.id}
                    style={{
                      border: "1px solid #7DD3FC",
                      background: "#E0F2FE",
                      borderRadius: 10,
                      padding: "12px 16px",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <div>
                      <span style={{ fontSize: 14, fontWeight: 700, color: "#083457" }}>{m.name}</span>
                      <span style={{ fontSize: 12, color: "#12578A", marginLeft: 8 }}>
                        {m.dosage} {m.unit} · {m.schedule}
                      </span>
                    </div>
                    <button
                      onClick={() => handleDeleteMed(m.id, m.name)}
                      style={{
                        background: "#FFE4E6",
                        border: "1px solid #FECDD3",
                        color: "#BE123C",
                        borderRadius: 6,
                        padding: "4px 8px",
                        fontSize: 11,
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      Delete
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Global Alerts Modal */}
      <GlobalAlertsModal
        isOpen={showAlertsModal}
        onClose={() => setShowAlertsModal(false)}
        onAlertChanged={fetchPatients}
      />
    </div>
  );
}

export default function PatientsPage() {
  return (
    <Suspense fallback={<div style={{ padding: 40, textAlign: "center" }}>Loading Care Dashboard...</div>}>
      <PatientsContent />
    </Suspense>
  );
}
