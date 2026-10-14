// app/patients/[id]/page.tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import type { PatientCondition, CarePlan, ConditionAlert, ConditionType } from "@/types/conditions";
import { OverviewTimeline } from "./components/OverviewTimeline";
import { DiabetesTab } from "./components/DiabetesTab";
import { HypertensionTab } from "./components/HypertensionTab";
import { DementiaTab } from "./components/DementiaTab";
import { DepressionTab } from "./components/DepressionTab";
import { AlertsTab } from "./components/AlertsTab";
import { ConditionSetupModal } from "./components/ConditionSetupModal";
import { PrescriptionCalendar } from "./components/PrescriptionCalendar";
import {
  SendSmsModal,
  CallCaregiverModal,
  LastSmsNote,
} from "../components/CommunicationModals";

export default function PatientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [patient, setPatient] = useState<any | null>(null);
  const [conditions, setConditions] = useState<PatientCondition[]>([]);
  const [carePlans, setCarePlans] = useState<CarePlan[]>([]);
  const [callAttempts, setCallAttempts] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<ConditionAlert[]>([]);
  const [loading, setLoading] = useState(true);

  // Active tab state: defaults to 'calendar' so prescription dates calendar is immediately shown
  const [activeTab, setActiveTab] = useState<string>("calendar");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const q = new URLSearchParams(window.location.search).get("tab");
      if (q) {
        setActiveTab(q);
      }
    }
  }, []);

  // Modals state
  const [showConditionSetup, setShowConditionSetup] = useState(false);
  const [showSmsModal, setShowSmsModal] = useState(false);
  const [showCallModal, setShowCallModal] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const fetchPatientData = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      const res = await fetch(`/api/patients/${id}`);
      const data = await res.json();
      if (data.patient) {
        setPatient(data.patient);
        setConditions(data.conditions || []);
        setCarePlans(data.care_plans || []);
        setCallAttempts(data.call_attempts || []);
        setAlerts(data.alerts || []);
      }
    } catch (err) {
      console.error("Error loading patient detail:", err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchPatientData();
  }, [fetchPatientData]);

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "linear-gradient(180deg, #BAE6FD 0%, #D4EEFD 40%, #C3E5FC 100%)", padding: 40, textAlign: "center", color: "#083457", fontWeight: 700, fontFamily: "Inter,ui-sans-serif,system-ui,sans-serif" }}>
        Loading patient profile...
      </div>
    );
  }

  if (!patient) {
    return (
      <div style={{ minHeight: "100vh", background: "linear-gradient(180deg, #BAE6FD 0%, #D4EEFD 40%, #C3E5FC 100%)", color: "#083457", padding: 40, textAlign: "center", fontFamily: "Inter,ui-sans-serif,system-ui,sans-serif" }}>
        <p style={{ fontSize: 18, fontWeight: 800, color: "#083457", marginBottom: 12 }}>Patient not found</p>
        <Link href="/patients" style={{ color: "#0C85D0", fontWeight: 700, textDecoration: "none" }}>
          ← Back to Patients List
        </Link>
      </div>
    );
  }

  // Active condition tags for module switching
  const activeConditionTypes = conditions.map((c) => c.condition_type);
  const openAlertsCount = alerts.filter((a) => a.status === "open").length;

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(180deg, #BAE6FD 0%, #D4EEFD 40%, #C3E5FC 100%)", color: "#083457", fontFamily: "Inter,ui-sans-serif,system-ui,sans-serif" }}>
      {/* Toast */}
      {toast && (
        <div style={{
          position: "fixed",
          bottom: 28,
          right: 28,
          zIndex: 99999,
          background: "linear-gradient(135deg, #1DA1F2 0%, #0C85D0 100%)",
          color: "#fff",
          padding: "12px 20px",
          borderRadius: 12,
          fontSize: 13,
          fontWeight: 700,
          boxShadow: "0 8px 24px rgba(12, 133, 208, 0.35)",
        }}>
          ✓ {toast}
        </div>
      )}

      {/* Top Breadcrumb & Actions Bar */}
      <div style={{
        background: "linear-gradient(135deg, #1DA1F2 0%, #0C85D0 100%)",
        borderBottom: "2px solid #0A72B3",
        padding: "0 32px",
        height: 56,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        boxShadow: "0 4px 16px rgba(12, 133, 208, 0.25)",
      }}>
        <Link href="/patients" style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          color: "#FFFFFF",
          textDecoration: "none",
          fontSize: 13,
          fontWeight: 700,
        }}>
          ← Back to Care Hub
        </Link>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button
            onClick={() => setShowSmsModal(true)}
            style={{
              padding: "7px 14px",
              borderRadius: 8,
              border: "1px solid rgba(255,255,255,0.4)",
              background: "rgba(8, 52, 87, 0.35)",
              color: "#FFFFFF",
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            💬 SMS Caregiver
          </button>
          <button
            onClick={() => setShowCallModal(true)}
            style={{
              padding: "7px 14px",
              borderRadius: 8,
              border: "1px solid rgba(255,255,255,0.4)",
              background: "rgba(8, 52, 87, 0.35)",
              color: "#FFFFFF",
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            📞 Call Caregiver
          </button>
          <button
            onClick={() => setShowConditionSetup(true)}
            style={{
              padding: "7px 16px",
              borderRadius: 8,
              background: "#083457",
              color: "#FFFFFF",
              border: "1px solid #0C4A7A",
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
              boxShadow: "0 2px 10px rgba(8, 52, 87, 0.3)",
            }}
          >
            ⚙️ Condition Setup
          </button>
        </div>
      </div>

      {/* Patient Header Banner */}
      <div style={{
        background: "#EDF7FE",
        borderBottom: "1.5px solid #7DD3FC",
        padding: "24px 32px",
      }}>
        <div style={{ maxWidth: 1240, margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
              <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: "#083457", letterSpacing: "-0.02em" }}>
                {patient.name}
              </h1>
              <span style={{
                fontSize: 12,
                fontWeight: 700,
                padding: "3px 10px",
                borderRadius: 999,
                background: patient.recheck_pending
                  ? "#FEF08A"
                  : patient.last_contact_status === "yes"
                  ? "#BAE6FD"
                  : "#E0F2FE",
                color: patient.recheck_pending
                  ? "#854D0E"
                  : patient.last_contact_status === "yes"
                  ? "#083457"
                  : "#12578A",
                border: `1px solid ${
                  patient.recheck_pending
                    ? "#FDE047"
                    : patient.last_contact_status === "yes"
                    ? "#7DD3FC"
                    : "#BAE6FD"
                }`,
              }}>
                {patient.recheck_pending ? "Re-check Pending" : patient.last_contact_status === "yes" ? "Adherent" : "Standby"}
              </span>
            </div>

            {/* Condition chips */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
              {activeConditionTypes.length > 0 ? (
                activeConditionTypes.map((cType) => {
                  const styleMap: Record<string, { bg: string; color: string; border: string }> = {
                    diabetes: { bg: "#BAE6FD", color: "#083457", border: "#7DD3FC" },
                    hypertension: { bg: "#FED7AA", color: "#9A3412", border: "#FDBA74" },
                    dementia: { bg: "#FEF08A", color: "#854D0E", border: "#FDE047" },
                    depression: { bg: "#DDD6FE", color: "#5B21B6", border: "#C4B5FD" },
                  };
                  const s = styleMap[cType] || { bg: "#E0F2FE", color: "#083457", border: "#7DD3FC" };
                  return (
                    <span
                      key={cType}
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        padding: "4px 10px",
                        borderRadius: 6,
                        background: s.bg,
                        color: s.color,
                        border: `1px solid ${s.border}`,
                        textTransform: "capitalize",
                      }}
                    >
                      {cType}
                    </span>
                  );
                })
              ) : (
                <span style={{ fontSize: 13, color: "#12578A" }}>No conditions assigned yet</span>
              )}
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 13, color: "#12578A" }}>
              <span>📞 Patient: <strong style={{ color: "#083457" }}>{patient.phone}</strong></span>
              {patient.family_phone && <span>•</span>}
              {patient.family_phone && <span>Family/Caregiver: <strong style={{ color: "#083457" }}>{patient.family_phone}</strong></span>}
            </div>
          </div>

          {/* Quick Metrics */}
          <div style={{ display: "flex", gap: 16 }}>
            <div style={{
              background: "#E0F2FE",
              border: "1.5px solid #7DD3FC",
              borderRadius: 12,
              padding: "12px 18px",
              textAlign: "center",
            }}>
              <p style={{ margin: "0 0 2px", fontSize: 11, fontWeight: 700, color: "#12578A", textTransform: "uppercase" }}>
                Active Conditions
              </p>
              <span style={{ fontSize: 20, fontWeight: 800, color: "#083457" }}>
                {activeConditionTypes.length}
              </span>
            </div>

            <div style={{
              background: openAlertsCount > 0 ? "#FEE2E2" : "#E0F2FE",
              border: `1.5px solid ${openAlertsCount > 0 ? "#FCA5A5" : "#7DD3FC"}`,
              borderRadius: 12,
              padding: "12px 18px",
              textAlign: "center",
            }}>
              <p style={{ margin: "0 0 2px", fontSize: 11, fontWeight: 700, color: openAlertsCount > 0 ? "#B91C1C" : "#083457", textTransform: "uppercase" }}>
                Open Alerts
              </p>
              <span style={{ fontSize: 20, fontWeight: 800, color: openAlertsCount > 0 ? "#B91C1C" : "#083457" }}>
                {openAlertsCount}
              </span>
            </div>
          </div>
        </div>

        {/* Dynamic Profile Tabs */}
        <div style={{ maxWidth: 1240, margin: "20px auto 0", display: "flex", gap: 8, borderBottom: "1.5px solid #7DD3FC", paddingBottom: 0, overflowX: "auto" }}>
          {/* Calendar Tab */}
          <button
            onClick={() => setActiveTab("calendar")}
            style={{
              padding: "10px 18px",
              border: "none",
              borderBottom: activeTab === "calendar" ? "3px solid #1DA1F2" : "3px solid transparent",
              background: activeTab === "calendar" ? "#D8EEFD" : "transparent",
              color: activeTab === "calendar" ? "#083457" : "#12578A",
              fontSize: 14,
              fontWeight: activeTab === "calendar" ? 800 : 600,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
              borderRadius: "8px 8px 0 0",
            }}
          >
            <span>📅</span>
            <span>Prescription Calendar</span>
          </button>

          {/* Overview Tab */}
          <button
            onClick={() => setActiveTab("overview")}
            style={{
              padding: "10px 16px",
              border: "none",
              borderBottom: activeTab === "overview" ? "3px solid #1DA1F2" : "3px solid transparent",
              background: activeTab === "overview" ? "#D8EEFD" : "transparent",
              color: activeTab === "overview" ? "#083457" : "#12578A",
              fontSize: 14,
              fontWeight: activeTab === "overview" ? 800 : 600,
              cursor: "pointer",
              borderRadius: "8px 8px 0 0",
            }}
          >
            📋 Clinical Overview
          </button>

          {/* Module-Switched Condition Tabs: One tab per active condition only! */}
          {activeConditionTypes.includes("diabetes") && (
            <button
              onClick={() => setActiveTab("diabetes")}
              style={{
                padding: "10px 16px",
                border: "none",
                borderBottom: activeTab === "diabetes" ? "3px solid #1DA1F2" : "3px solid transparent",
                background: "transparent",
                color: activeTab === "diabetes" ? "#083457" : "#12578A",
                fontSize: 14,
                fontWeight: activeTab === "diabetes" ? 800 : 600,
                cursor: "pointer",
              }}
            >
              🩸 Diabetes
            </button>
          )}

          {activeConditionTypes.includes("hypertension") && (
            <button
              onClick={() => setActiveTab("hypertension")}
              style={{
                padding: "10px 16px",
                border: "none",
                borderBottom: activeTab === "hypertension" ? "3px solid #1DA1F2" : "3px solid transparent",
                background: "transparent",
                color: activeTab === "hypertension" ? "#083457" : "#12578A",
                fontSize: 14,
                fontWeight: activeTab === "hypertension" ? 800 : 600,
                cursor: "pointer",
              }}
            >
              ❤️ Hypertension (BP)
            </button>
          )}

          {activeConditionTypes.includes("dementia") && (
            <button
              onClick={() => setActiveTab("dementia")}
              style={{
                padding: "10px 16px",
                border: "none",
                borderBottom: activeTab === "dementia" ? "3px solid #1DA1F2" : "3px solid transparent",
                background: "transparent",
                color: activeTab === "dementia" ? "#083457" : "#12578A",
                fontSize: 14,
                fontWeight: activeTab === "dementia" ? 800 : 600,
                cursor: "pointer",
              }}
            >
              🧠 Dementia
            </button>
          )}

          {activeConditionTypes.includes("depression") && (
            <button
              onClick={() => setActiveTab("depression")}
              style={{
                padding: "10px 16px",
                border: "none",
                borderBottom: activeTab === "depression" ? "3px solid #1DA1F2" : "3px solid transparent",
                background: "transparent",
                color: activeTab === "depression" ? "#083457" : "#12578A",
                fontSize: 14,
                fontWeight: activeTab === "depression" ? 800 : 600,
                cursor: "pointer",
              }}
            >
              🌧️ Depression
            </button>
          )}

          {/* Medicines Tab */}
          <button
            onClick={() => setActiveTab("medicines")}
            style={{
              padding: "10px 16px",
              border: "none",
              borderBottom: activeTab === "medicines" ? "3px solid #1DA1F2" : "3px solid transparent",
              background: "transparent",
              color: activeTab === "medicines" ? "#083457" : "#12578A",
              fontSize: 14,
              fontWeight: activeTab === "medicines" ? 800 : 600,
              cursor: "pointer",
            }}
          >
            💊 Medicines
          </button>

          {/* Call History Tab */}
          <button
            onClick={() => setActiveTab("calls")}
            style={{
              padding: "10px 16px",
              border: "none",
              borderBottom: activeTab === "calls" ? "3px solid #1DA1F2" : "3px solid transparent",
              background: "transparent",
              color: activeTab === "calls" ? "#083457" : "#12578A",
              fontSize: 14,
              fontWeight: activeTab === "calls" ? 800 : 600,
              cursor: "pointer",
            }}
          >
            📞 Call History ({callAttempts.length})
          </button>

          {/* Alerts Tab */}
          <button
            onClick={() => setActiveTab("alerts")}
            style={{
              padding: "10px 16px",
              border: "none",
              borderBottom: activeTab === "alerts" ? "3px solid #1DA1F2" : "3px solid transparent",
              background: "transparent",
              color: activeTab === "alerts" ? "#083457" : "#12578A",
              fontSize: 14,
              fontWeight: activeTab === "alerts" ? 800 : 600,
              cursor: "pointer",
            }}
          >
            ⚠️ Alerts ({alerts.length})
          </button>
        </div>
      </div>

      {/* Main Tab Content Body */}
      <div style={{ maxWidth: 1240, margin: "0 auto", padding: "28px 32px" }}>
        {/* Prescription Calendar Tab (Default) */}
        {activeTab === "calendar" && (
          <PrescriptionCalendar
            patient={patient}
            onEditMedications={() => setShowConditionSetup(true)}
          />
        )}

        {/* Overview Tab */}
        {activeTab === "overview" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {/* Quick Calendar Jump Banner */}
            <div
              style={{
                background: "linear-gradient(135deg, #E0F2FE 0%, #BAE6FD 100%)",
                border: "1.5px solid #7DD3FC",
                borderRadius: 14,
                padding: "16px 20px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: 12,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: 24 }}>📅</span>
                <div>
                  <h4 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: "#083457" }}>
                    Active Prescription Schedule & Dates
                  </h4>
                  <p style={{ margin: "2px 0 0", fontSize: 13, color: "#12578A" }}>
                    {patient.medications
                      ? `${patient.medications.slice(0, 80)}...`
                      : "Prescription dates and daily dose slots tracked by Raksha"}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setActiveTab("calendar")}
                style={{
                  padding: "8px 16px",
                  borderRadius: 8,
                  background: "#083457",
                  color: "#FFFFFF",
                  border: "none",
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                View Full Calendar →
              </button>
            </div>

            <OverviewTimeline
              patientId={id}
              callAttempts={callAttempts}
              alerts={alerts}
            />
          </div>
        )}

        {/* Diabetes Tab */}
        {activeTab === "diabetes" && activeConditionTypes.includes("diabetes") && (
          <DiabetesTab
            patientId={id}
            thresholds={carePlans.find((c) => c.condition_type === "diabetes")?.thresholds}
            alerts={alerts}
            onAlertUpdated={fetchPatientData}
          />
        )}

        {/* Hypertension Tab */}
        {activeTab === "hypertension" && activeConditionTypes.includes("hypertension") && (
          <HypertensionTab
            patientId={id}
            thresholds={carePlans.find((c) => c.condition_type === "hypertension")?.thresholds}
            alerts={alerts}
            onAlertUpdated={fetchPatientData}
          />
        )}

        {/* Dementia Tab */}
        {activeTab === "dementia" && activeConditionTypes.includes("dementia") && (
          <DementiaTab
            patientId={id}
            thresholds={carePlans.find((c) => c.condition_type === "dementia")?.thresholds}
            alerts={alerts}
            onAlertUpdated={fetchPatientData}
          />
        )}

        {/* Depression Tab */}
        {activeTab === "depression" && activeConditionTypes.includes("depression") && (
          <DepressionTab
            patientId={id}
            thresholds={carePlans.find((c) => c.condition_type === "depression")?.thresholds}
            alerts={alerts}
            onAlertUpdated={fetchPatientData}
          />
        )}

        {/* Medicines Tab */}
        {activeTab === "medicines" && (
          <PrescriptionCalendar
            patient={patient}
            onEditMedications={() => setShowConditionSetup(true)}
          />
        )}

        {/* Call History Tab */}
        {activeTab === "calls" && (
          <div style={{ background: "#EDF7FE", border: "1.5px solid #7DD3FC", borderRadius: 16, padding: "24px", boxShadow: "0 4px 20px rgba(12, 133, 208, 0.12)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 18, paddingBottom: 14, borderBottom: "1.5px solid #BAE6FD" }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 20 }}>📞</span>
                  <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: "#083457" }}>
                    Outbound Voice & IVR Check-in History
                  </h3>
                  <span style={{
                    fontSize: 12,
                    fontWeight: 800,
                    padding: "3px 8px",
                    borderRadius: 6,
                    background: "#BAE6FD",
                    color: "#083457",
                  }}>
                    {callAttempts.length} Total
                  </span>
                </div>
                <p style={{ margin: "4px 0 0 30px", fontSize: 13, color: "#12578A" }}>
                  Live call records logged in Supabase and synchronized with the Caregiver Telegram bot.
                </p>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <button
                  onClick={() => {
                    fetchPatientData();
                    setToast("Call logs refreshed.");
                    setTimeout(() => setToast(null), 2500);
                  }}
                  style={{
                    padding: "7px 14px",
                    borderRadius: 8,
                    border: "1.5px solid #7DD3FC",
                    background: "#E0F2FE",
                    color: "#083457",
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <span>🔄</span> Refresh Logs
                </button>
                <button
                  onClick={() => setShowCallModal(true)}
                  style={{
                    padding: "7px 16px",
                    borderRadius: 8,
                    border: "none",
                    background: "linear-gradient(135deg, #1DA1F2 0%, #0C85D0 100%)",
                    color: "#FFFFFF",
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: "pointer",
                    boxShadow: "0 2px 10px rgba(12, 133, 208, 0.3)",
                  }}
                >
                  📞 Call Caregiver Now
                </button>
              </div>
            </div>

            {callAttempts.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px 20px", color: "#12578A" }}>
                <span style={{ fontSize: 32, display: "block", marginBottom: 8 }}>📭</span>
                <p style={{ fontSize: 15, fontWeight: 700, margin: "0 0 4px", color: "#083457" }}>No voice call records yet.</p>
                <p style={{ fontSize: 13, margin: 0 }}>Initiate a call or run a medication check to view history here.</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {callAttempts.map((ca: any) => {
                  const isSuccess = ca.outcome === "completed" || ca.outcome === "yes";
                  const isNo = ca.outcome === "no";
                  const isFailed = ["no-answer", "busy", "failed", "canceled"].includes(ca.outcome);
                  const outcomeBg = isSuccess ? "#BAE6FD" : isNo ? "#FEE2E2" : isFailed ? "#FEF08A" : "#E0F2FE";
                  const outcomeColor = isSuccess ? "#083457" : isNo ? "#991B1B" : isFailed ? "#854D0E" : "#0C4A7A";
                  const outcomeBorder = isSuccess ? "#7DD3FC" : isNo ? "#FCA5A5" : isFailed ? "#FDE047" : "#BAE6FD";
                  const outcomeLabel = isSuccess
                    ? "✓ Confirmed"
                    : isNo
                    ? "✕ Not Taken"
                    : isFailed
                    ? `⚠️ ${ca.outcome.toUpperCase()}`
                    : `ℹ️ ${ca.outcome.toUpperCase()}`;

                  return (
                    <div
                      key={ca.id}
                      style={{
                        border: "1.5px solid #BAE6FD",
                        background: "#FFFFFF",
                        borderRadius: 12,
                        padding: "14px 18px",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        flexWrap: "wrap",
                        gap: 12,
                        boxShadow: "0 2px 8px rgba(12, 133, 208, 0.06)",
                      }}
                    >
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                          <span style={{
                            fontSize: 12,
                            fontWeight: 800,
                            padding: "3px 10px",
                            borderRadius: 6,
                            background: outcomeBg,
                            color: outcomeColor,
                            border: `1px solid ${outcomeBorder}`,
                          }}>
                            {outcomeLabel}
                          </span>
                          <span style={{ fontSize: 14, color: "#083457", fontWeight: 800 }}>
                            Voice Attempt #{ca.attempt_number || 1}
                          </span>
                          {ca.is_recheck && (
                            <span style={{
                              fontSize: 11,
                              fontWeight: 700,
                              padding: "2px 6px",
                              borderRadius: 4,
                              background: "#FED7AA",
                              color: "#C2410C",
                              border: "1px solid #FDBA74",
                            }}>
                              Re-check
                            </span>
                          )}
                          <span style={{
                            fontSize: 11,
                            fontWeight: 600,
                            padding: "2px 6px",
                            borderRadius: 4,
                            background: "#F0F9FF",
                            color: "#0369A1",
                            border: "1px solid #BAE6FD",
                          }}>
                            Twilio Voice IVR 📞
                          </span>
                        </div>

                        <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 12, color: "#12578A" }}>
                          {ca.twilio_call_sid && (
                            <span>SID: <code style={{ background: "#E0F2FE", padding: "1px 4px", borderRadius: 4, fontSize: 11 }}>{ca.twilio_call_sid.slice(0, 18)}...</code></span>
                          )}
                          <span>•</span>
                          <span style={{ color: "#0C85D0", fontWeight: 600 }}>🤖 Synced to Caregiver Telegram</span>
                        </div>
                      </div>

                      <div style={{ textAlign: "right" }}>
                        <span style={{ fontSize: 12, color: "#083457", fontWeight: 700, display: "block" }}>
                          {new Date(ca.created_at).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hour12: true })}
                        </span>
                        <span style={{ fontSize: 11, color: "#12578A", fontWeight: 500 }}>
                          {new Date(ca.created_at).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric" })}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Alerts Tab */}
        {activeTab === "alerts" && (
          <AlertsTab alerts={alerts} onAlertUpdated={fetchPatientData} />
        )}
      </div>

      {/* Condition Setup Modal */}
      <ConditionSetupModal
        patientId={id}
        activeConditions={conditions}
        carePlans={carePlans}
        isOpen={showConditionSetup}
        onClose={() => setShowConditionSetup(false)}
        onUpdated={fetchPatientData}
      />

      {/* Existing Communication Modals */}
      <SendSmsModal
        isOpen={showSmsModal}
        patient={{
          id: patient.id,
          name: patient.name,
          phone: patient.phone,
          caregivers: [{ name: "Family", relation: "Primary", phone: patient.family_phone || "", isPrimary: true }],
        } as any}
        onClose={() => setShowSmsModal(false)}
        onSuccess={(msg) => {
          setToast(msg || "SMS alert dispatched.");
          setTimeout(() => setToast(null), 3000);
          fetchPatientData();
        }}
      />

      <CallCaregiverModal
        isOpen={showCallModal}
        patient={{
          id: patient.id,
          name: patient.name,
          phone: patient.phone,
          caregivers: [{ name: "Family", relation: "Primary", phone: patient.family_phone || "", isPrimary: true }],
        } as any}
        onClose={() => setShowCallModal(false)}
        onSuccess={(msg) => {
          setToast(msg || "Call dispatched.");
          setTimeout(() => setToast(null), 3000);
          fetchPatientData();
        }}
      />
    </div>
  );
}
