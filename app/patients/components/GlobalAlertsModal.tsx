// app/patients/components/GlobalAlertsModal.tsx
"use client";

import { useState, useEffect } from "react";
import type { ConditionAlert } from "@/types/conditions";
import { formatIstDateTime } from "@/lib/istDate";
import Link from "next/link";

export function GlobalAlertsModal({
  isOpen,
  onClose,
  onAlertChanged,
}: {
  isOpen: boolean;
  onClose: () => void;
  onAlertChanged?: () => void;
}) {
  const [alerts, setAlerts] = useState<ConditionAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const fetchAlerts = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/condition-alerts?status=open&limit=100");
      const data = await res.json();
      if (data.alerts) {
        setAlerts(data.alerts);
      }
    } catch (err) {
      console.error("Error fetching open alerts:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchAlerts();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleUpdate = async (id: string, status: "acknowledged" | "resolved") => {
    try {
      setUpdatingId(id);
      await fetch("/api/condition-alerts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      // Optimistic update
      setAlerts((prev) => prev.filter((a) => a.id !== id));
      if (onAlertChanged) onAlertChanged();
    } catch (err) {
      console.error("Failed to update alert:", err);
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div style={{
      position: "fixed",
      inset: 0,
      background: "rgba(8, 52, 87, 0.4)",
      backdropFilter: "blur(6px)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 9999,
      padding: 20,
    }}>
      <div style={{
        background: "#EDF7FE",
        border: "1.5px solid #7DD3FC",
        borderRadius: 20,
        maxWidth: 760,
        width: "100%",
        maxHeight: "85vh",
        display: "flex",
        flexDirection: "column",
        boxShadow: "0 25px 50px rgba(12, 133, 208, 0.25)",
      }}>
        {/* Header */}
        <div style={{
          padding: "20px 24px",
          borderBottom: "1.5px solid #BAE6FD",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "#083457" }}>
              Active Care Alerts Across Patients
            </h2>
            <p style={{ margin: "4px 0 0", fontSize: 13, color: "#12578A" }}>
              Sorted by severity: Urgent crisis &gt; Warnings &gt; Routine notifications
            </p>
          </div>
          <button
            onClick={onClose}
            style={{ border: "none", background: "none", fontSize: 20, cursor: "pointer", color: "#8B98A5" }}
          >
            ✕
          </button>
        </div>

        {/* List */}
        <div style={{ padding: "20px 24px", overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: 12 }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: "center", color: "#12578A", fontWeight: 600 }}>Loading active alerts...</div>
          ) : alerts.length === 0 ? (
            <div style={{ padding: 40, textAlign: "center", color: "#083457", fontWeight: 800 }}>
              🎉 All clear! No open condition alerts across all active patients.
            </div>
          ) : (
            alerts.map((alt) => {
              const isUrgent = alt.severity === "urgent";

              return (
                <div
                  key={alt.id}
                  style={{
                    border: isUrgent ? "1.5px solid #FCA5A5" : "1.5px solid #FDE68A",
                    background: isUrgent ? "#FEE2E2" : "#FEF9C3",
                    borderRadius: 14,
                    padding: "16px 18px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 16,
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <span style={{
                        fontSize: 11,
                        fontWeight: 800,
                        padding: "2px 8px",
                        borderRadius: 6,
                        background: isUrgent ? "#DC2626" : "#D97706",
                        color: "#fff",
                        textTransform: "uppercase",
                      }}>
                        {alt.severity}
                      </span>
                      <span style={{ fontSize: 13, fontWeight: 800, color: "#083457" }}>
                        {alt.patient_name || "Patient"}
                      </span>
                      <span style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: "#083457", background: "#BAE6FD", border: "1px solid #7DD3FC",
                        padding: "1px 7px",
                        borderRadius: 6,
                        textTransform: "capitalize",
                      }}>
                        {alt.condition_type}
                      </span>
                      <span style={{ fontSize: 11, color: "#12578A" }}>
                        {formatIstDateTime(alt.created_at)}
                      </span>
                    </div>

                    <p style={{ margin: "4px 0 0", fontSize: 14, fontWeight: 700, color: "#083457", lineHeight: 1.4 }}>
                      {alt.message}
                    </p>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                    <Link
                      href={`/patients/${alt.patient_id}`}
                      onClick={onClose}
                      style={{
                        padding: "7px 12px",
                        borderRadius: 8,
                        background: "#E0F2FE", border: "1.5px solid #7DD3FC", color: "#083457", fontSize: 12, fontWeight: 700, textDecoration: "none",
                      }}
                    >
                      View Patient
                    </Link>
                    <button
                      onClick={() => handleUpdate(alt.id, "resolved")}
                      disabled={updatingId === alt.id}
                      style={{
                        padding: "7px 12px",
                        borderRadius: 8,
                        background: "linear-gradient(135deg, #1DA1F2 0%, #0C85D0 100%)", border: "none", color: "#fff", fontSize: 12, fontWeight: 800, cursor: "pointer", boxShadow: "0 2px 8px rgba(12, 133, 208, 0.3)",
                      }}
                    >
                      Resolve
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: "14px 24px", borderTop: "1.5px solid #BAE6FD", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 13, color: "#12578A" }}>
            {alerts.length} open alert{alerts.length === 1 ? "" : "s"} requiring attention
          </span>
          <button
            onClick={onClose}
            style={{
              padding: "7px 14px", borderRadius: 8, border: "1.5px solid #7DD3FC", background: "#E0F2FE", color: "#083457", fontSize: 13, fontWeight: 700, cursor: "pointer",
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
