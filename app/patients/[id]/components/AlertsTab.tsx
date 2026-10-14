// app/patients/[id]/components/AlertsTab.tsx
"use client";

import { useState } from "react";
import type { ConditionAlert } from "@/types/conditions";
import { formatIstDateTime } from "@/lib/istDate";

export function AlertsTab({
  alerts,
  onAlertUpdated,
}: {
  alerts: ConditionAlert[];
  onAlertUpdated: () => void;
}) {
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const handleUpdateStatus = async (alertId: string, status: "acknowledged" | "resolved") => {
    try {
      setUpdatingId(alertId);
      const res = await fetch("/api/condition-alerts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: alertId, status }),
      });
      if (!res.ok) throw new Error("Failed to update alert");
      onAlertUpdated();
    } catch (err) {
      console.error("Alert update error:", err);
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 16, padding: "24px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "#111827" }}>
            Patient Clinical Alerts
          </h3>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "#6B7280" }}>
            Condition threshold breaches and adherence alerts requiring care team review.
          </p>
        </div>
        <span style={{ fontSize: 12, background: "#F3F4F6", color: "#4B5563", padding: "4px 10px", borderRadius: 8, fontWeight: 600 }}>
          {alerts.length} Total Alerts
        </span>
      </div>

      {alerts.length === 0 ? (
        <div style={{ padding: 40, textAlign: "center", color: "#9CA3AF" }}>
          No alerts recorded for this patient. All thresholds within target limits.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {alerts.map((alt) => {
            const isUrgent = alt.severity === "urgent";
            const isOpen = alt.status === "open";

            return (
              <div
                key={alt.id}
                style={{
                  border: `1.5px solid ${isUrgent && isOpen ? "#FCA5A5" : isOpen ? "#FDE68A" : "#E5E7EB"}`,
                  background: isUrgent && isOpen ? "#FEF2F2" : isOpen ? "#FFFBEB" : "#F9FAFB",
                  borderRadius: 14,
                  padding: "16px 20px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 16,
                  opacity: alt.status === "resolved" ? 0.7 : 1,
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <span style={{
                      fontSize: 11,
                      fontWeight: 800,
                      padding: "2px 8px",
                      borderRadius: 6,
                      background: isUrgent ? "#DC2626" : alt.severity === "warning" ? "#D97706" : "#2563EB",
                      color: "#fff",
                      textTransform: "uppercase",
                    }}>
                      {alt.severity}
                    </span>
                    <span style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: "#4B5563",
                      background: "#fff",
                      padding: "2px 8px",
                      borderRadius: 6,
                      border: "1px solid #E5E7EB",
                      textTransform: "capitalize",
                    }}>
                      {alt.condition_type}
                    </span>
                    <span style={{ fontSize: 12, color: "#9CA3AF" }}>
                      {formatIstDateTime(alt.created_at)}
                    </span>
                  </div>

                  <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "#111827", lineHeight: 1.4 }}>
                    {alt.message}
                  </p>
                </div>

                {/* Actions */}
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {alt.status === "open" && (
                    <button
                      onClick={() => handleUpdateStatus(alt.id, "acknowledged")}
                      disabled={updatingId === alt.id}
                      style={{
                        padding: "8px 14px",
                        borderRadius: 8,
                        background: "#fff",
                        border: "1px solid #D1D5DB",
                        color: "#374151",
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      Acknowledge
                    </button>
                  )}

                  {alt.status !== "resolved" ? (
                    <button
                      onClick={() => handleUpdateStatus(alt.id, "resolved")}
                      disabled={updatingId === alt.id}
                      style={{
                        padding: "8px 14px",
                        borderRadius: 8,
                        background: "#0D9488",
                        border: "none",
                        color: "#fff",
                        fontSize: 13,
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      Resolve
                    </button>
                  ) : (
                    <span style={{ fontSize: 13, color: "#059669", fontWeight: 700 }}>
                      ✓ Resolved
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
