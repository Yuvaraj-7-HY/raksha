// app/patients/[id]/components/DiabetesTab.tsx
"use client";

import { useState, useEffect } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
} from "recharts";
import type { Reading, ConditionAlert } from "@/types/conditions";
import { formatIstDateTime } from "@/lib/istDate";

export function DiabetesTab({
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
  const [readings, setReadings] = useState<Reading[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form state
  const [readingType, setReadingType] = useState<
    "glucose_fasting" | "glucose_post_meal" | "glucose_bedtime"
  >("glucose_fasting");
  const [value, setValue] = useState("");
  const [note, setNote] = useState("");

  const fetchReadings = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/readings?patient_id=${patientId}&condition_type=diabetes&limit=30`);
      const data = await res.json();
      if (data.readings) {
        setReadings(data.readings);
      }
    } catch (err: any) {
      console.error("Error fetching diabetes readings:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReadings();
  }, [patientId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const num = parseFloat(value);
    if (isNaN(num)) {
      setError("Please enter a valid glucose number");
      return;
    }

    try {
      setSubmitting(true);
      const res = await fetch("/api/readings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patient_id: patientId,
          condition_type: "diabetes",
          reading_type: readingType,
          value: num,
          unit: "mg/dL",
          note: note || null,
          source: "clinician",
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to log reading");
      }

      setValue("");
      setNote("");
      setSuccess("Glucose reading recorded successfully");
      await fetchReadings();
      onAlertUpdated();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Compute 7-day average (past 7 days)
  const past7DaysReadings = readings.filter((r) => {
    const diff = (Date.now() - new Date(r.recorded_at).getTime()) / (1000 * 60 * 60 * 24);
    return diff <= 7 && r.reading_type !== "hba1c";
  });
  const avg7d =
    past7DaysReadings.length > 0
      ? Math.round(
          past7DaysReadings.reduce((sum, r) => sum + Number(r.value), 0) / past7DaysReadings.length
        )
      : null;

  // Latest HbA1c
  const latestHba1c = readings.find((r) => r.reading_type === "hba1c");

  // Chart data: chronological (oldest to newest)
  const chartData = [...readings]
    .filter((r) => r.reading_type !== "hba1c")
    .reverse()
    .map((r) => ({
      time: new Date(r.recorded_at).toLocaleDateString("en-IN", {
        month: "short",
        day: "numeric",
      }),
      glucose: Number(r.value),
      type: r.reading_type.replace("glucose_", "").replace("_", " "),
    }));

  const openDiabetesAlerts = alerts.filter(
    (a) => a.condition_type === "diabetes" && a.status === "open"
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Top Metric Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
        {/* 7-Day Average */}
        <div style={{
          background: "#fff",
          border: "1px solid #E5E7EB",
          borderRadius: 14,
          padding: "20px 24px",
          boxShadow: "0 1px 3px rgba(0,0,0,0.04)"
        }}>
          <p style={{ margin: "0 0 6px", fontSize: 13, fontWeight: 600, color: "#6B7280" }}>
            7-Day Glucose Average
          </p>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <span style={{ fontSize: 32, fontWeight: 800, color: avg7d && avg7d > 140 ? "#D97706" : "#0D9488" }}>
              {avg7d ?? "—"}
            </span>
            <span style={{ fontSize: 14, color: "#9CA3AF", fontWeight: 600 }}>mg/dL</span>
          </div>
          <p style={{ margin: "6px 0 0", fontSize: 12, color: "#9CA3AF" }}>
            {past7DaysReadings.length} readings past week
          </p>
        </div>

        {/* Latest HbA1c */}
        <div style={{
          background: "#fff",
          border: "1px solid #E5E7EB",
          borderRadius: 14,
          padding: "20px 24px",
          boxShadow: "0 1px 3px rgba(0,0,0,0.04)"
        }}>
          <p style={{ margin: "0 0 6px", fontSize: 13, fontWeight: 600, color: "#6B7280" }}>
            Latest HbA1c
          </p>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <span style={{ fontSize: 32, fontWeight: 800, color: latestHba1c && Number(latestHba1c.value) > 7 ? "#D97706" : "#0D9488" }}>
              {latestHba1c ? latestHba1c.value : "—"}
            </span>
            <span style={{ fontSize: 14, color: "#9CA3AF", fontWeight: 600 }}>%</span>
          </div>
          <p style={{ margin: "6px 0 0", fontSize: 12, color: "#9CA3AF" }}>
            {latestHba1c ? `Recorded ${formatIstDateTime(latestHba1c.recorded_at)}` : "No lab HbA1c recorded"}
          </p>
        </div>

        {/* Open Alerts */}
        <div style={{
          background: openDiabetesAlerts.length > 0 ? "#FEF2F2" : "#F0FDF4",
          border: `1px solid ${openDiabetesAlerts.length > 0 ? "#FCA5A5" : "#BBF7D0"}`,
          borderRadius: 14,
          padding: "20px 24px",
          boxShadow: "0 1px 3px rgba(0,0,0,0.04)"
        }}>
          <p style={{ margin: "0 0 6px", fontSize: 13, fontWeight: 600, color: openDiabetesAlerts.length > 0 ? "#991B1B" : "#166534" }}>
            Active Diabetes Alerts
          </p>
          <span style={{ fontSize: 32, fontWeight: 800, color: openDiabetesAlerts.length > 0 ? "#DC2626" : "#16A34A" }}>
            {openDiabetesAlerts.length}
          </span>
          <p style={{ margin: "6px 0 0", fontSize: 12, color: openDiabetesAlerts.length > 0 ? "#B91C1C" : "#15803D" }}>
            {openDiabetesAlerts.length > 0 ? openDiabetesAlerts[0].message : "All thresholds within target"}
          </p>
        </div>
      </div>

      {/* Main Grid: Trend Chart + Quick Add Form */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 24, alignItems: "start" }}>
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
                Blood Glucose Trends (mg/dL)
              </h3>
              <p style={{ margin: "4px 0 0", fontSize: 13, color: "#6B7280" }}>
                Target range: 70 - 130 mg/dL (fasting), &lt; 250 (urgent threshold)
              </p>
            </div>
            <span style={{ fontSize: 12, background: "#CCFBF1", color: "#0F766E", padding: "4px 10px", borderRadius: 8, fontWeight: 600 }}>
              {chartData.length} Readings
            </span>
          </div>

          {loading ? (
            <div style={{ height: 300, display: "flex", alignItems: "center", justifyContent: "center", color: "#9CA3AF" }}>
              Loading chart data...
            </div>
          ) : chartData.length === 0 ? (
            <div style={{ height: 300, display: "flex", alignItems: "center", justifyContent: "center", color: "#9CA3AF", textAlign: "center" }}>
              No readings yet. Add the first one on the right.
            </div>
          ) : (
            <div style={{ height: 320 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                  <XAxis dataKey="time" stroke="#9CA3AF" fontSize={12} tickLine={false} />
                  <YAxis stroke="#9CA3AF" fontSize={12} domain={[40, 300]} tickLine={false} />
                  <Tooltip
                    contentStyle={{ background: "#fff", borderRadius: 8, border: "1px solid #E5E7EB", fontSize: 13 }}
                    formatter={(val: any) => [`${val} mg/dL`, "Glucose"]}
                  />
                  {/* Reference threshold lines */}
                  <ReferenceLine y={250} stroke="#EF4444" strokeDasharray="4 4" label={{ value: "Urgent High (250)", fill: "#DC2626", fontSize: 11 }} />
                  <ReferenceLine y={130} stroke="#F59E0B" strokeDasharray="4 4" label={{ value: "Fasting Target (130)", fill: "#D97706", fontSize: 11 }} />
                  <ReferenceLine y={70} stroke="#DC2626" strokeDasharray="4 4" label={{ value: "Urgent Low (70)", fill: "#DC2626", fontSize: 11 }} />
                  <Line
                    type="monotone"
                    dataKey="glucose"
                    stroke="#0D9488"
                    strokeWidth={3}
                    dot={{ fill: "#0D9488", r: 4 }}
                    activeDot={{ r: 7 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Quick Add Form */}
        <div style={{
          background: "#fff",
          border: "1px solid #E5E7EB",
          borderRadius: 16,
          padding: "24px",
          boxShadow: "0 1px 3px rgba(0,0,0,0.04)"
        }}>
          <h3 style={{ margin: "0 0 6px", fontSize: 16, fontWeight: 700, color: "#111827" }}>
            Log Glucose Reading
          </h3>
          <p style={{ margin: "0 0 20px", fontSize: 13, color: "#6B7280" }}>
            Record fasting, post-meal, or bedtime check.
          </p>

          {error && (
            <div style={{ background: "#FEE2E2", color: "#DC2626", padding: "10px 12px", borderRadius: 8, fontSize: 13, marginBottom: 16 }}>
              {error}
            </div>
          )}
          {success && (
            <div style={{ background: "#D1FAE5", color: "#059669", padding: "10px 12px", borderRadius: 8, fontSize: 13, marginBottom: 16 }}>
              {success}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6 }}>
                Timing Slot
              </label>
              <select
                value={readingType}
                onChange={(e) => setReadingType(e.target.value as any)}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: 10,
                  border: "1.5px solid #D1D5DB",
                  fontSize: 14,
                  outline: "none",
                }}
              >
                <option value="glucose_fasting">Fasting (Morning pre-breakfast)</option>
                <option value="glucose_post_meal">Post-Meal (2 hrs after food)</option>
                <option value="glucose_bedtime">Bedtime</option>
              </select>
            </div>

            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6 }}>
                Blood Glucose (mg/dL)
              </label>
              <input
                type="number"
                min="20"
                max="600"
                step="1"
                placeholder="e.g. 118"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                required
                style={{
                  width: "100%",
                  padding: "12px 14px",
                  borderRadius: 10,
                  border: "1.5px solid #D1D5DB",
                  fontSize: 16,
                  fontWeight: 600,
                  outline: "none",
                }}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6 }}>
                Clinical Note (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. Post light breakfast"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: 10,
                  border: "1.5px solid #D1D5DB",
                  fontSize: 14,
                  outline: "none",
                }}
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              style={{
                marginTop: 8,
                padding: "12px 18px",
                background: "#0D9488",
                color: "#fff",
                border: "none",
                borderRadius: 10,
                fontSize: 15,
                fontWeight: 700,
                cursor: submitting ? "not-allowed" : "pointer",
                opacity: submitting ? 0.7 : 1,
                boxShadow: "0 2px 6px rgba(13,148,136,0.25)",
              }}
            >
              {submitting ? "Saving..." : "+ Save Reading"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
