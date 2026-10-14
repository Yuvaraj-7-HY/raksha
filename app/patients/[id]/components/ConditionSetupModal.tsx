// app/patients/[id]/components/ConditionSetupModal.tsx
"use client";

import { useState } from "react";
import {
  CONDITION_TYPES,
  CONDITION_LABELS,
  DEFAULT_THRESHOLDS,
  THRESHOLD_UI_LABEL,
  CLINICAL_DISCLAIMER,
  type ConditionType,
  type PatientCondition,
  type CarePlan,
} from "@/types/conditions";

export function ConditionSetupModal({
  patientId,
  activeConditions,
  carePlans,
  isOpen,
  onClose,
  onUpdated,
}: {
  patientId: string;
  activeConditions: PatientCondition[];
  carePlans: CarePlan[];
  isOpen: boolean;
  onClose: () => void;
  onUpdated: () => void;
}) {
  const [selectedConditions, setSelectedConditions] = useState<Record<ConditionType, boolean>>({
    diabetes: activeConditions.some((c) => c.condition_type === "diabetes" && c.is_active),
    hypertension: activeConditions.some((c) => c.condition_type === "hypertension" && c.is_active),
    dementia: activeConditions.some((c) => c.condition_type === "dementia" && c.is_active),
    depression: activeConditions.some((c) => c.condition_type === "depression" && c.is_active),
  });

  // Local thresholds state initialized from carePlans or defaults
  const [thresholdsMap, setThresholdsMap] = useState<Record<ConditionType, Record<string, any>>>(() => {
    const map: Record<ConditionType, Record<string, any>> = {
      diabetes: { ...DEFAULT_THRESHOLDS.diabetes },
      hypertension: { ...DEFAULT_THRESHOLDS.hypertension },
      dementia: { ...DEFAULT_THRESHOLDS.dementia },
      depression: { ...DEFAULT_THRESHOLDS.depression },
    };
    carePlans.forEach((cp) => {
      if (cp.condition_type && cp.thresholds) {
        map[cp.condition_type] = { ...map[cp.condition_type], ...cp.thresholds };
      }
    });
    return map;
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleToggleCondition = (cType: ConditionType) => {
    setSelectedConditions((prev) => ({ ...prev, [cType]: !prev[cType] }));
  };

  const handleThresholdChange = (cType: ConditionType, key: string, val: any) => {
    setThresholdsMap((prev) => ({
      ...prev,
      [cType]: {
        ...prev[cType],
        [key]: val,
      },
    }));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);

      // 1. Update active conditions
      for (const cType of CONDITION_TYPES) {
        const isCurrentlyActive = activeConditions.some(
          (c) => c.condition_type === cType && c.is_active
        );
        const shouldBeActive = selectedConditions[cType];

        if (shouldBeActive && !isCurrentlyActive) {
          await fetch("/api/patient-conditions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ patient_id: patientId, condition_type: cType }),
          });
        } else if (!shouldBeActive && isCurrentlyActive) {
          await fetch(`/api/patient-conditions?patient_id=${patientId}&condition_type=${cType}`, {
            method: "DELETE",
          });
        }

        // 2. Save thresholds if condition is active
        if (shouldBeActive) {
          await fetch("/api/care-plans", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              patient_id: patientId,
              condition_type: cType,
              thresholds: thresholdsMap[cType],
              updated_by: "Care Team Clinician",
            }),
          });
        }
      }

      onUpdated();
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to update configuration");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{
      position: "fixed",
      inset: 0,
      background: "rgba(0,0,0,0.5)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 9999,
      padding: 20,
    }}>
      <div style={{
        background: "#fff",
        borderRadius: 20,
        maxWidth: 680,
        width: "100%",
        maxHeight: "90vh",
        display: "flex",
        flexDirection: "column",
        boxShadow: "0 20px 40px rgba(0,0,0,0.2)",
      }}>
        {/* Header */}
        <div style={{ padding: "20px 24px", borderBottom: "1px solid #E5E7EB", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "#111827" }}>
              Condition Setup &amp; Care Thresholds
            </h2>
            <p style={{ margin: "4px 0 0", fontSize: 13, color: "#0D9488", fontWeight: 600 }}>
              {THRESHOLD_UI_LABEL}
            </p>
          </div>
          <button
            onClick={onClose}
            style={{ border: "none", background: "none", fontSize: 20, cursor: "pointer", color: "#9CA3AF" }}
          >
            ✕
          </button>
        </div>

        {/* Scrollable Content */}
        <div style={{ padding: "20px 24px", overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Disclaimer banner */}
          <div style={{
            background: "#FFFBEB",
            border: "1px solid #FDE68A",
            borderRadius: 10,
            padding: "10px 14px",
            fontSize: 12,
            color: "#92400E",
            lineHeight: 1.5,
          }}>
            ⚖️ <strong>Clinical Rule:</strong> {CLINICAL_DISCLAIMER}
          </div>

          {error && (
            <div style={{ background: "#FEE2E2", color: "#DC2626", padding: "10px 14px", borderRadius: 10, fontSize: 13 }}>
              {error}
            </div>
          )}

          {/* Condition Cards */}
          {CONDITION_TYPES.map((cType) => {
            const isChecked = selectedConditions[cType];
            const currentT = thresholdsMap[cType];

            return (
              <div
                key={cType}
                style={{
                  border: `1.5px solid ${isChecked ? "#0D9488" : "#E5E7EB"}`,
                  borderRadius: 14,
                  background: isChecked ? "#F0FDFA" : "#fff",
                  padding: "16px 18px",
                  transition: "all 0.15s ease",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <input
                      type="checkbox"
                      id={`chk_${cType}`}
                      checked={isChecked}
                      onChange={() => handleToggleCondition(cType)}
                      style={{ width: 20, height: 20, accentColor: "#0D9488", cursor: "pointer" }}
                    />
                    <label htmlFor={`chk_${cType}`} style={{ fontSize: 16, fontWeight: 700, color: "#111827", cursor: "pointer" }}>
                      {CONDITION_LABELS[cType]}
                    </label>
                  </div>
                  <span style={{
                    fontSize: 12,
                    fontWeight: 700,
                    padding: "3px 10px",
                    borderRadius: 999,
                    background: isChecked ? "#CCFBF1" : "#F3F4F6",
                    color: isChecked ? "#0F766E" : "#9CA3AF",
                  }}>
                    {isChecked ? "Module Active" : "Disabled"}
                  </span>
                </div>

                {/* Collapsible Threshold Inputs when active */}
                {isChecked && (
                  <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px dashed #CCFBF1", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    {cType === "diabetes" && (
                      <>
                        <div>
                          <label style={{ fontSize: 12, fontWeight: 600, color: "#374151" }}>Fasting Warning (&gt; mg/dL)</label>
                          <input
                            type="number"
                            value={currentT.glucoseFastingWarning}
                            onChange={(e) => handleThresholdChange("diabetes", "glucoseFastingWarning", Number(e.target.value))}
                            style={{ width: "100%", padding: "6px 10px", borderRadius: 8, border: "1px solid #D1D5DB", fontSize: 13, marginTop: 4 }}
                          />
                        </div>
                        <div>
                          <label style={{ fontSize: 12, fontWeight: 600, color: "#374151" }}>Urgent High (&gt; mg/dL)</label>
                          <input
                            type="number"
                            value={currentT.glucoseUrgentHigh}
                            onChange={(e) => handleThresholdChange("diabetes", "glucoseUrgentHigh", Number(e.target.value))}
                            style={{ width: "100%", padding: "6px 10px", borderRadius: 8, border: "1px solid #D1D5DB", fontSize: 13, marginTop: 4 }}
                          />
                        </div>
                        <div>
                          <label style={{ fontSize: 12, fontWeight: 600, color: "#374151" }}>Urgent Low (&lt; mg/dL)</label>
                          <input
                            type="number"
                            value={currentT.glucoseUrgentLow}
                            onChange={(e) => handleThresholdChange("diabetes", "glucoseUrgentLow", Number(e.target.value))}
                            style={{ width: "100%", padding: "6px 10px", borderRadius: 8, border: "1px solid #D1D5DB", fontSize: 13, marginTop: 4 }}
                          />
                        </div>
                      </>
                    )}

                    {cType === "hypertension" && (
                      <>
                        <div>
                          <label style={{ fontSize: 12, fontWeight: 600, color: "#374151" }}>Systolic Warning (&gt;= mmHg)</label>
                          <input
                            type="number"
                            value={currentT.systolicWarning}
                            onChange={(e) => handleThresholdChange("hypertension", "systolicWarning", Number(e.target.value))}
                            style={{ width: "100%", padding: "6px 10px", borderRadius: 8, border: "1px solid #D1D5DB", fontSize: 13, marginTop: 4 }}
                          />
                        </div>
                        <div>
                          <label style={{ fontSize: 12, fontWeight: 600, color: "#374151" }}>Diastolic Warning (&gt;= mmHg)</label>
                          <input
                            type="number"
                            value={currentT.diastolicWarning}
                            onChange={(e) => handleThresholdChange("hypertension", "diastolicWarning", Number(e.target.value))}
                            style={{ width: "100%", padding: "6px 10px", borderRadius: 8, border: "1px solid #D1D5DB", fontSize: 13, marginTop: 4 }}
                          />
                        </div>
                        <div>
                          <label style={{ fontSize: 12, fontWeight: 600, color: "#374151" }}>Crisis Systolic (&gt;= mmHg)</label>
                          <input
                            type="number"
                            value={currentT.systolicUrgent}
                            onChange={(e) => handleThresholdChange("hypertension", "systolicUrgent", Number(e.target.value))}
                            style={{ width: "100%", padding: "6px 10px", borderRadius: 8, border: "1px solid #D1D5DB", fontSize: 13, marginTop: 4 }}
                          />
                        </div>
                        <div>
                          <label style={{ fontSize: 12, fontWeight: 600, color: "#374151" }}>Crisis Diastolic (&gt;= mmHg)</label>
                          <input
                            type="number"
                            value={currentT.diastolicUrgent}
                            onChange={(e) => handleThresholdChange("hypertension", "diastolicUrgent", Number(e.target.value))}
                            style={{ width: "100%", padding: "6px 10px", borderRadius: 8, border: "1px solid #D1D5DB", fontSize: 13, marginTop: 4 }}
                          />
                        </div>
                      </>
                    )}

                    {cType === "depression" && (
                      <>
                        <div>
                          <label style={{ fontSize: 12, fontWeight: 600, color: "#374151" }}>PHQ-9 Moderate Warning (&gt;=)</label>
                          <input
                            type="number"
                            value={currentT.phq9WarningMin}
                            onChange={(e) => handleThresholdChange("depression", "phq9WarningMin", Number(e.target.value))}
                            style={{ width: "100%", padding: "6px 10px", borderRadius: 8, border: "1px solid #D1D5DB", fontSize: 13, marginTop: 4 }}
                          />
                        </div>
                        <div>
                          <label style={{ fontSize: 12, fontWeight: 600, color: "#374151" }}>PHQ-9 Severe Urgent (&gt;=)</label>
                          <input
                            type="number"
                            value={currentT.phq9UrgentMin}
                            onChange={(e) => handleThresholdChange("depression", "phq9UrgentMin", Number(e.target.value))}
                            style={{ width: "100%", padding: "6px 10px", borderRadius: 8, border: "1px solid #D1D5DB", fontSize: 13, marginTop: 4 }}
                          />
                        </div>
                      </>
                    )}

                    {cType === "dementia" && (
                      <div>
                        <label style={{ fontSize: 12, fontWeight: 600, color: "#374151" }}>Confusion Warning Threshold (&gt;=)</label>
                        <input
                          type="number"
                          min="1"
                          max="5"
                          value={currentT.confusionWarningThreshold}
                          onChange={(e) => handleThresholdChange("dementia", "confusionWarningThreshold", Number(e.target.value))}
                          style={{ width: "100%", padding: "6px 10px", borderRadius: 8, border: "1px solid #D1D5DB", fontSize: 13, marginTop: 4 }}
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div style={{ padding: "16px 24px", borderTop: "1px solid #E5E7EB", display: "flex", justifyContent: "flex-end", gap: 12 }}>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            style={{
              padding: "10px 18px",
              background: "#F3F4F6",
              color: "#374151",
              border: "none",
              borderRadius: 10,
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            style={{
              padding: "10px 22px",
              background: "#0D9488",
              color: "#fff",
              border: "none",
              borderRadius: 10,
              fontSize: 14,
              fontWeight: 700,
              cursor: saving ? "not-allowed" : "pointer",
              boxShadow: "0 2px 6px rgba(13,148,136,0.25)",
            }}
          >
            {saving ? "Saving..." : "Save Configuration"}
          </button>
        </div>
      </div>
    </div>
  );
}
