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

  // Active tab state: defaults to 'overview'
  const [activeTab, setActiveTab] = useState<string>("overview");

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
      <div style={{ minHeight: "100vh", background: "#F8FAFC", padding: 40, textAlign: "center", color: "#64748B" }}>
        Loading patient profile...
      </div>
    );
  }

  if (!patient) {
    return (
      <div style={{ minHeight: "100vh", background: "#F8FAFC", padding: 40, textAlign: "center" }}>
        <p style={{ fontSize: 18, fontWeight: 700, color: "#0F172A" }}>Patient not found</p>
        <Link href="/patients" style={{ color: "#0D9488", fontWeight: 700, textDecoration: "none" }}>
          ← Back to Patients List
        </Link>
      </div>
    );
  }

  // Active condition tags for module switching
  const activeConditionTypes = conditions.map((c) => c.condition_type);
  const openAlertsCount = alerts.filter((a) => a.status === "open").length;

  return (
    <div style={{ minHeight: "100vh", background: "#F8FAFC", fontFamily: "Inter,ui-sans-serif,system-ui,sans-serif" }}>
      {/* Toast */}
      {toast && (
        <div style={{
          position: "fixed",
          bottom: 28,
          right: 28,
          zIndex: 99999,
          background: "#111827",
          color: "#fff",
          padding: "12px 20px",
          borderRadius: 12,
          fontSize: 13,
          fontWeight: 600,
          boxShadow: "0 8px 24px rgba(0,0,0,0.2)",
        }}>
          ✓ {toast}
        </div>
      )}

      {/* Top Breadcrumb & Actions Bar */}
      <div style={{
        background: "#fff",
        borderBottom: "1px solid #E2E8F0",
        padding: "0 32px",
        height: 56,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}>
        <Link href="/patients" style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          color: "#475569",
          textDecoration: "none",
          fontSize: 13,
          fontWeight: 600,
        }}>
          ← Back to Care Hub
        </Link>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button
            onClick={() => setShowSmsModal(true)}
            style={{
              padding: "7px 14px",
              borderRadius: 8,
              border: "1px solid #CBD5E1",
              background: "#fff",
              color: "#334155",
              fontSize: 13,
              fontWeight: 600,
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
              border: "1px solid #CBD5E1",
              background: "#fff",
              color: "#334155",
              fontSize: 13,
              fontWeight: 600,
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
              background: "#0D9488",
              color: "#fff",
              border: "none",
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
              boxShadow: "0 2px 6px rgba(13,148,136,0.25)",
            }}
          >
            ⚙️ Condition Setup
          </button>
        </div>
      </div>

      {/* Patient Header Banner */}
      <div style={{
        background: "#fff",
        borderBottom: "1px solid #E2E8F0",
        padding: "24px 32px",
      }}>
        <div style={{ maxWidth: 1240, margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
              <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: "#0F172A", letterSpacing: "-0.02em" }}>
                {patient.name}
              </h1>
              <span style={{
                fontSize: 12,
                fontWeight: 700,
                padding: "3px 10px",
                borderRadius: 999,
                background: patient.recheck_pending ? "#FFFBEB" : patient.last_contact_status === "yes" ? "#F0FDF4" : "#F1F5F9",
                color: patient.recheck_pending ? "#D97706" : patient.last_contact_status === "yes" ? "#16A34A" : "#64748B",
              }}>
                {patient.recheck_pending ? "Re-check Pending" : patient.last_contact_status === "yes" ? "Adherent" : "Standby"}
              </span>
            </div>

            {/* Condition chips */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
              {activeConditionTypes.length > 0 ? (
                activeConditionTypes.map((cType) => (
                  <span
                    key={cType}
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      padding: "3px 10px",
                      borderRadius: 6,
                      background: cType === "diabetes" ? "#CCFBF1" : cType === "hypertension" ? "#FFE4E6" : cType === "dementia" ? "#FEF3C7" : "#EDE9FE",
                      color: cType === "diabetes" ? "#0F766E" : cType === "hypertension" ? "#BE123C" : cType === "dementia" ? "#B45309" : "#6D28D9",
                      textTransform: "capitalize",
                    }}
                  >
                    {cType}
                  </span>
                ))
              ) : (
                <span style={{ fontSize: 13, color: "#94A3B8" }}>No conditions assigned yet</span>
              )}
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 13, color: "#64748B" }}>
              <span>📞 Patient: <strong>{patient.phone}</strong></span>
              {patient.family_phone && <span>•</span>}
              {patient.family_phone && <span>Family/Caregiver: <strong>{patient.family_phone}</strong></span>}
            </div>
          </div>

          {/* Quick Metrics */}
          <div style={{ display: "flex", gap: 16 }}>
            <div style={{
              background: "#F8FAFC",
              border: "1px solid #E2E8F0",
              borderRadius: 12,
              padding: "12px 18px",
              textAlign: "center",
            }}>
              <p style={{ margin: "0 0 2px", fontSize: 11, fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>
                Active Conditions
              </p>
              <span style={{ fontSize: 20, fontWeight: 800, color: "#0F172A" }}>
                {activeConditionTypes.length}
              </span>
            </div>

            <div style={{
              background: openAlertsCount > 0 ? "#FEF2F2" : "#F0FDF4",
              border: `1px solid ${openAlertsCount > 0 ? "#FCA5A5" : "#BBF7D0"}`,
              borderRadius: 12,
              padding: "12px 18px",
              textAlign: "center",
            }}>
              <p style={{ margin: "0 0 2px", fontSize: 11, fontWeight: 700, color: openAlertsCount > 0 ? "#991B1B" : "#166534", textTransform: "uppercase" }}>
                Open Alerts
              </p>
              <span style={{ fontSize: 20, fontWeight: 800, color: openAlertsCount > 0 ? "#DC2626" : "#16A34A" }}>
                {openAlertsCount}
              </span>
            </div>
          </div>
        </div>

        {/* Dynamic Profile Tabs */}
        <div style={{ maxWidth: 1240, margin: "20px auto 0", display: "flex", gap: 8, borderBottom: "1px solid #E2E8F0", paddingBottom: 0, overflowX: "auto" }}>
          {/* Overview Tab */}
          <button
            onClick={() => setActiveTab("overview")}
            style={{
              padding: "10px 16px",
              border: "none",
              borderBottom: activeTab === "overview" ? "3px solid #0D9488" : "3px solid transparent",
              background: "transparent",
              color: activeTab === "overview" ? "#0D9488" : "#64748B",
              fontSize: 14,
              fontWeight: activeTab === "overview" ? 700 : 500,
              cursor: "pointer",
            }}
          >
            📋 Overview
          </button>

          {/* Module-Switched Condition Tabs: One tab per active condition only! */}
          {activeConditionTypes.includes("diabetes") && (
            <button
              onClick={() => setActiveTab("diabetes")}
              style={{
                padding: "10px 16px",
                border: "none",
                borderBottom: activeTab === "diabetes" ? "3px solid #0D9488" : "3px solid transparent",
                background: "transparent",
                color: activeTab === "diabetes" ? "#0D9488" : "#64748B",
                fontSize: 14,
                fontWeight: activeTab === "diabetes" ? 700 : 500,
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
                borderBottom: activeTab === "hypertension" ? "3px solid #0D9488" : "3px solid transparent",
                background: "transparent",
                color: activeTab === "hypertension" ? "#0D9488" : "#64748B",
                fontSize: 14,
                fontWeight: activeTab === "hypertension" ? 700 : 500,
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
                borderBottom: activeTab === "dementia" ? "3px solid #0D9488" : "3px solid transparent",
                background: "transparent",
                color: activeTab === "dementia" ? "#0D9488" : "#64748B",
                fontSize: 14,
                fontWeight: activeTab === "dementia" ? 700 : 500,
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
                borderBottom: activeTab === "depression" ? "3px solid #0D9488" : "3px solid transparent",
                background: "transparent",
                color: activeTab === "depression" ? "#0D9488" : "#64748B",
                fontSize: 14,
                fontWeight: activeTab === "depression" ? 700 : 500,
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
              borderBottom: activeTab === "medicines" ? "3px solid #0D9488" : "3px solid transparent",
              background: "transparent",
              color: activeTab === "medicines" ? "#0D9488" : "#64748B",
              fontSize: 14,
              fontWeight: activeTab === "medicines" ? 700 : 500,
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
              borderBottom: activeTab === "calls" ? "3px solid #0D9488" : "3px solid transparent",
              background: "transparent",
              color: activeTab === "calls" ? "#0D9488" : "#64748B",
              fontSize: 14,
              fontWeight: activeTab === "calls" ? 700 : 500,
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
              borderBottom: activeTab === "alerts" ? "3px solid #0D9488" : "3px solid transparent",
              background: "transparent",
              color: activeTab === "alerts" ? "#0D9488" : "#64748B",
              fontSize: 14,
              fontWeight: activeTab === "alerts" ? 700 : 500,
              cursor: "pointer",
            }}
          >
            ⚠️ Alerts ({alerts.length})
          </button>
        </div>
      </div>

      {/* Main Tab Content Body */}
      <div style={{ maxWidth: 1240, margin: "0 auto", padding: "28px 32px" }}>
        {/* Overview Tab */}
        {activeTab === "overview" && (
          <OverviewTimeline
            patientId={id}
            callAttempts={callAttempts}
            alerts={alerts}
          />
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
          <div style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 16, padding: "24px" }}>
            <h3 style={{ margin: "0 0 12px", fontSize: 17, fontWeight: 700, color: "#0F172A" }}>
              Prescribed Medications
            </h3>
            {patient.medications ? (
              <div style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 12, padding: "16px 20px" }}>
                <p style={{ margin: 0, fontSize: 14, color: "#334155", lineHeight: 1.6 }}>
                  {patient.medications}
                </p>
              </div>
            ) : (
              <p style={{ color: "#94A3B8" }}>No specific medications logged in profile.</p>
            )}
          </div>
        )}

        {/* Call History Tab */}
        {activeTab === "calls" && (
          <div style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 16, padding: "24px" }}>
            <h3 style={{ margin: "0 0 16px", fontSize: 17, fontWeight: 700, color: "#0F172A" }}>
              Outbound IVR Voice Check-in History
            </h3>
            {callAttempts.length === 0 ? (
              <p style={{ color: "#94A3B8", textAlign: "center", padding: 32 }}>No voice call records yet.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {callAttempts.map((ca: any) => (
                  <div
                    key={ca.id}
                    style={{
                      border: "1px solid #E2E8F0",
                      borderRadius: 10,
                      padding: "12px 18px",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <div>
                      <span style={{
                        fontSize: 12,
                        fontWeight: 700,
                        padding: "2px 8px",
                        borderRadius: 6,
                        background: ca.outcome === "completed" || ca.outcome === "yes" ? "#DCFCE7" : "#FEE2E2",
                        color: ca.outcome === "completed" || ca.outcome === "yes" ? "#166534" : "#991B1B",
                        marginRight: 10,
                      }}>
                        {ca.outcome.toUpperCase()}
                      </span>
                      <span style={{ fontSize: 13, color: "#475569" }}>
                        Attempt #{ca.attempt_number || 1} {ca.is_recheck ? "(Re-check)" : ""}
                      </span>
                    </div>
                    <span style={{ fontSize: 12, color: "#94A3B8" }}>
                      {new Date(ca.created_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}
                    </span>
                  </div>
                ))}
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
        }}
      />
    </div>
  );
}
