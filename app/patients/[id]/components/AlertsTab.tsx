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
    <div style={{ background: "#EDF7FE", border: "1.5px solid #7DD3FC", borderRadius: 16, padding: "24px", boxShadow: "0 4px 20px rgba(12, 133, 208, 0.12)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: "#083457" }}>
            Patient Clinical Alerts
          </h3>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "#12578A" }}>
            Condition threshold breaches and adherence alerts requiring care team review.
          </p>
        </div>
        <span style={{ fontSize: 12, background: "#BAE6FD", color: "#083457", padding: "4px 10px", borderRadius: 8, fontWeight: 700, border: "1px solid #7DD3FC" }}>
          {alerts.length} Total Alerts
        </span>
      </div>

      {alerts.length === 0 ? (
        <div style={{ padding: 40, textAlign: "center", color: "#12578A", fontWeight: 600 }}>
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
                  border: `1.5px solid ${isUrgent && isOpen ? "#FCA5A5" : isOpen ? "#FDE68A" : "#BAE6FD"}`,
                  background: isUrgent && isOpen ? "#FEE2E2" : isOpen ? "#FEF9C3" : "#F0F9FF",
                  borderRadius: 14,
                  padding: "16px 20px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 16,
                  opacity: alt.status === "resolved" ? 0.75 : 1,
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <span style={{
                      fontSize: 11,
                      fontWeight: 800,
                      padding: "2px 8px",
                      borderRadius: 6,
                      background: isUrgent ? "#EF4444" : alt.severity === "warning" ? "#F59E0B" : "#1DA1F2",
                      color: "#fff",
                      textTransform: "uppercase",
                    }}>
                      {alt.severity}
                    </span>
                    <span style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: "#083457",
                      background: "#BAE6FD",
                      padding: "2px 8px",
                      borderRadius: 6,
                      border: "1px solid #7DD3FC",
                      textTransform: "capitalize",
                    }}>
                      {alt.condition_type}
                    </span>
                    <span style={{ fontSize: 12, color: "#12578A", fontWeight: 500 }}>
                      {formatIstDateTime(alt.created_at)}
                    </span>
                  </div>

                  <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#083457", lineHeight: 1.4 }}>
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
                        background: "#E0F2FE",
                        border: "1.5px solid #7DD3FC",
                        color: "#083457",
                        fontSize: 13,
                        fontWeight: 700,
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
                        background: "linear-gradient(135deg, #1DA1F2 0%, #0C85D0 100%)",
                        border: "none",
                        color: "#fff",
                        fontSize: 13,
                        fontWeight: 800,
                        cursor: "pointer",
                        boxShadow: "0 2px 8px rgba(12, 133, 208, 0.3)",
                      }}
                    >
                      Resolve
                    </button>
                  ) : (
                    <span style={{ fontSize: 13, color: "#083457", fontWeight: 800 }}>
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
