// app/patients/[id]/components/DementiaTab.tsx
"use client";

import { useState, useEffect } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import type { CaregiverLog, ConditionAlert } from "@/types/conditions";

export function DementiaTab({
  patientId,
  thresholds,
  alerts,
  onAlertUpdated,
}: {
  patientId: string;
  thresholds?: any;
  alerts: ConditionAlert[];
  onAlertUpdated: () => void;
}) {
  const [logs, setLogs] = useState<CaregiverLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form state
  const [confusionLevel, setConfusionLevel] = useState<number>(2);
  const [sleepQuality, setSleepQuality] = useState<number>(3);
  const [appetite, setAppetite] = useState<number>(3);
  const [agitationOrWandering, setAgitationOrWandering] = useState<boolean>(false);
  const [medicineConfirmed, setMedicineConfirmed] = useState<boolean>(true);
  const [loggedBy, setLoggedBy] = useState("Caregiver");
  const [notes, setNotes] = useState("");

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/caregiver-logs?patient_id=${patientId}&limit=14`);
      const data = await res.json();
      if (data.logs) {
        setLogs(data.logs);
      }
    } catch (err: any) {
      console.error("Error fetching caregiver logs:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [patientId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    try {
      setSubmitting(true);
      const res = await fetch("/api/caregiver-logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patient_id: patientId,
          logged_by: loggedBy || "Caregiver",
          confusion_level: confusionLevel,
          sleep_quality: sleepQuality,
          appetite: appetite,
          agitation_or_wandering: agitationOrWandering,
          medicine_confirmed: medicineConfirmed,
          notes: notes || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to log checklist");
      }

      setNotes("");
      setSuccess("Caregiver daily checklist recorded");
      await fetchLogs();
      onAlertUpdated();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const chartData = [...logs].reverse().map((l) => ({
    date: new Date(l.created_at).toLocaleDateString("en-IN", {
      month: "short",
      day: "numeric",
    }),
    confusion: l.confusion_level,
    sleep: l.sleep_quality,
    appetite: l.appetite,
    agitation: l.agitation_or_wandering ? 5 : 0,
  }));

  const openDementiaAlerts = alerts.filter(
    (a) => a.condition_type === "dementia" && a.status === "open"
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Privacy banner */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        background: "#EFF6FF",
        border: "1px solid #BFDBFE",
        borderRadius: 12,
        padding: "12px 18px",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{
            background: "#1E40AF",
            color: "#fff",
            fontSize: 11,
            fontWeight: 800,
            padding: "3px 8px",
            borderRadius: 6,
            letterSpacing: "0.04em"
          }}>
            RESTRICTED: CARE TEAM ONLY
          </span>
          <span style={{ fontSize: 13, color: "#1E3A8A", fontWeight: 500 }}>
            Dementia cognitive observations and caregiver logs are confidential.
          </span>
        </div>
        <span style={{ fontSize: 12, color: "#3B82F6", fontWeight: 600 }}>14-Day View</span>
      </div>

      {/* Main Grid: 14-day Chart + Daily Checklist Form */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1.2fr", gap: 24, alignItems: "start" }}>
        {/* Trend Chart */}
        <div style={{
          background: "#fff",
          border: "1px solid #E5E7EB",
          borderRadius: 16,
          padding: "24px",
          boxShadow: "0 1px 3px rgba(0,0,0,0.04)"
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "#111827" }}>
                14-Day Cognitive & Wellness Scores (Scale 1-5)
              </h3>
              <p style={{ margin: "4px 0 0", fontSize: 13, color: "#6B7280" }}>
                Confusion level &gt;= 4 or agitation flags trigger care alerts
              </p>
            </div>
            {openDementiaAlerts.length > 0 && (
              <span style={{ background: "#FEE2E2", color: "#DC2626", padding: "4px 10px", borderRadius: 8, fontSize: 12, fontWeight: 700 }}>
                {openDementiaAlerts.length} Open Alerts
              </span>
            )}
          </div>

          {loading ? (
            <div style={{ height: 320, display: "flex", alignItems: "center", justifyContent: "center", color: "#9CA3AF" }}>
              Loading caregiver logs...
            </div>
          ) : chartData.length === 0 ? (
            <div style={{ height: 320, display: "flex", alignItems: "center", justifyContent: "center", color: "#9CA3AF", textAlign: "center" }}>
              No caregiver logs yet. Submit the daily checklist on the right.
            </div>
          ) : (
            <div style={{ height: 340 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                  <XAxis dataKey="date" stroke="#9CA3AF" fontSize={12} tickLine={false} />
                  <YAxis stroke="#9CA3AF" fontSize={12} domain={[0, 5]} ticks={[1, 2, 3, 4, 5]} tickLine={false} />
                  <Tooltip contentStyle={{ background: "#fff", borderRadius: 8, border: "1px solid #E5E7EB", fontSize: 13 }} />
                  <Legend wrapperStyle={{ fontSize: 12, paddingTop: 10 }} />
                  <Bar dataKey="confusion" name="Confusion (1-5)" fill="#F59E0B" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="sleep" name="Sleep Quality (1-5)" fill="#0D9488" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="appetite" name="Appetite (1-5)" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Daily Caregiver Checklist Form */}
        <div style={{
          background: "#fff",
          border: "1px solid #E5E7EB",
          borderRadius: 16,
          padding: "24px",
          boxShadow: "0 1px 3px rgba(0,0,0,0.04)"
        }}>
          <h3 style={{ margin: "0 0 6px", fontSize: 16, fontWeight: 700, color: "#111827" }}>
            Daily Caregiver Checklist
          </h3>
          <p style={{ margin: "0 0 16px", fontSize: 13, color: "#6B7280" }}>
            Daily behavioral and medication observation.
          </p>

          {error && (
            <div style={{ background: "#FEE2E2", color: "#DC2626", padding: "10px 12px", borderRadius: 8, fontSize: 13, marginBottom: 14 }}>
              {error}
            </div>
          )}
          {success && (
            <div style={{ background: "#D1FAE5", color: "#059669", padding: "10px 12px", borderRadius: 8, fontSize: 13, marginBottom: 14 }}>
              {success}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {/* Confusion Slider / Rating */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>Confusion Level</label>
                <span style={{ fontSize: 13, fontWeight: 700, color: confusionLevel >= 4 ? "#DC2626" : "#0D9488" }}>
                  {confusionLevel} / 5 {confusionLevel >= 4 ? "(High)" : ""}
                </span>
              </div>
              <input
                type="range"
                min="1"
                max="5"
                value={confusionLevel}
                onChange={(e) => setConfusionLevel(parseInt(e.target.value, 10))}
                style={{ width: "100%", accentColor: confusionLevel >= 4 ? "#DC2626" : "#0D9488" }}
              />
            </div>

            {/* Sleep Quality */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>Sleep Quality</label>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#0D9488" }}>{sleepQuality} / 5</span>
              </div>
              <input
                type="range"
                min="1"
                max="5"
                value={sleepQuality}
                onChange={(e) => setSleepQuality(parseInt(e.target.value, 10))}
                style={{ width: "100%", accentColor: "#0D9488" }}
              />
            </div>

            {/* Appetite */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>Appetite</label>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#0D9488" }}>{appetite} / 5</span>
              </div>
              <input
                type="range"
                min="1"
                max="5"
                value={appetite}
                onChange={(e) => setAppetite(parseInt(e.target.value, 10))}
                style={{ width: "100%", accentColor: "#0D9488" }}
              />
            </div>

            {/* Agitation / Wandering Toggle */}
            <div style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "10px 12px",
              background: agitationOrWandering ? "#FEF2F2" : "#F9FAFB",
              borderRadius: 10,
              border: `1px solid ${agitationOrWandering ? "#FCA5A5" : "#E5E7EB"}`
            }}>
              <div>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: agitationOrWandering ? "#991B1B" : "#374151" }}>
                  Agitation or Wandering
                </p>
                <p style={{ margin: "2px 0 0", fontSize: 11, color: "#6B7280" }}>Flag restless or wandering behavior</p>
              </div>
              <input
                type="checkbox"
                checked={agitationOrWandering}
                onChange={(e) => setAgitationOrWandering(e.target.checked)}
                style={{ width: 18, height: 18, accentColor: "#DC2626", cursor: "pointer" }}
              />
            </div>

            {/* Medicine Confirmed Toggle */}
            <div style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "10px 12px",
              background: medicineConfirmed ? "#F0FDF4" : "#FFFBEB",
              borderRadius: 10,
              border: `1px solid ${medicineConfirmed ? "#BBF7D0" : "#FDE68A"}`
            }}>
              <div>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: medicineConfirmed ? "#166534" : "#92400E" }}>
                  Medicine Confirmed Today
                </p>
                <p style={{ margin: "2px 0 0", fontSize: 11, color: "#6B7280" }}>Caregiver witnessed pill intake</p>
              </div>
              <input
                type="checkbox"
                checked={medicineConfirmed}
                onChange={(e) => setMedicineConfirmed(e.target.checked)}
                style={{ width: 18, height: 18, accentColor: "#0D9488", cursor: "pointer" }}
              />
            </div>

            {/* Notes */}
            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 4 }}>
                Caregiver Notes
              </label>
              <textarea
                rows={2}
                placeholder="e.g. Recognized grandson on call. Calm evening."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  borderRadius: 10,
                  border: "1.5px solid #D1D5DB",
                  fontSize: 13,
                  outline: "none",
                  resize: "none",
                }}
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              style={{
                marginTop: 6,
                padding: "12px 18px",
                background: "#0D9488",
                color: "#fff",
                border: "none",
                borderRadius: 10,
                fontSize: 15,
                fontWeight: 700,
                cursor: submitting ? "not-allowed" : "pointer",
                boxShadow: "0 2px 6px rgba(13,148,136,0.25)",
              }}
            >
              {submitting ? "Submitting..." : "+ Submit Daily Checklist"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
