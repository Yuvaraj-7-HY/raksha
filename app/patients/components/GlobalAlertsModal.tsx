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
        maxWidth: 760,
        width: "100%",
        maxHeight: "85vh",
        display: "flex",
        flexDirection: "column",
        boxShadow: "0 20px 40px rgba(0,0,0,0.2)",
      }}>
        {/* Header */}
        <div style={{
          padding: "20px 24px",
          borderBottom: "1px solid #E5E7EB",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "#111827" }}>
              Active Care Alerts Across Patients
            </h2>
            <p style={{ margin: "4px 0 0", fontSize: 13, color: "#6B7280" }}>
              Sorted by severity: Urgent crisis &gt; Warnings &gt; Routine notifications
            </p>
          </div>
          <button
            onClick={onClose}
            style={{ border: "none", background: "none", fontSize: 20, cursor: "pointer", color: "#9CA3AF" }}
          >
            ✕
          </button>
        </div>

        {/* List */}
        <div style={{ padding: "20px 24px", overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: 12 }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: "center", color: "#9CA3AF" }}>Loading active alerts...</div>
          ) : alerts.length === 0 ? (
            <div style={{ padding: 40, textAlign: "center", color: "#16A34A", fontWeight: 600 }}>
              🎉 All clear! No open condition alerts across all active patients.
            </div>
          ) : (
            alerts.map((alt) => {
              const isUrgent = alt.severity === "urgent";

              return (
                <div
                  key={alt.id}
                  style={{
                    border: `1.5px solid ${isUrgent ? "#FCA5A5" : "#FDE68A"}`,
                    background: isUrgent ? "#FEF2F2" : "#FFFBEB",
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
                      <span style={{ fontSize: 13, fontWeight: 800, color: "#111827" }}>
                        {alt.patient_name || "Patient"}
                      </span>
                      <span style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: "#0F766E",
                        background: "#CCFBF1",
                        padding: "1px 7px",
                        borderRadius: 6,
                        textTransform: "capitalize",
                      }}>
                        {alt.condition_type}
                      </span>
                      <span style={{ fontSize: 11, color: "#9CA3AF" }}>
                        {formatIstDateTime(alt.created_at)}
                      </span>
                    </div>

                    <p style={{ margin: "4px 0 0", fontSize: 14, fontWeight: 600, color: "#1F2937", lineHeight: 1.4 }}>
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
                        background: "#fff",
                        border: "1px solid #D1D5DB",
                        color: "#374151",
                        fontSize: 12,
                        fontWeight: 600,
                        textDecoration: "none",
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
                        background: "#0D9488",
                        border: "none",
                        color: "#fff",
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: "pointer",
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
        <div style={{ padding: "14px 24px", borderTop: "1px solid #E5E7EB", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 13, color: "#6B7280" }}>
            {alerts.length} open alert{alerts.length === 1 ? "" : "s"} requiring attention
          </span>
          <button
            onClick={onClose}
            style={{
              padding: "8px 16px",
              background: "#F3F4F6",
              color: "#374151",
              border: "none",
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
