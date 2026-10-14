// app/patients/[id]/components/HypertensionTab.tsx
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

export function HypertensionTab({
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
  const [systolic, setSystolic] = useState("");
  const [diastolic, setDiastolic] = useState("");
  const [pulse, setPulse] = useState("");
  const [note, setNote] = useState("");

  const fetchReadings = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/readings?patient_id=${patientId}&condition_type=hypertension&limit=50`);
      const data = await res.json();
      if (data.readings) {
        setReadings(data.readings);
      }
    } catch (err: any) {
      console.error("Error fetching hypertension readings:", err);
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

    const sysNum = parseFloat(systolic);
    const diaNum = parseFloat(diastolic);
    const pulseNum = pulse ? parseFloat(pulse) : null;

    if (isNaN(sysNum) || isNaN(diaNum)) {
      setError("Please enter valid systolic and diastolic values");
      return;
    }

    try {
      setSubmitting(true);
      const now = new Date().toISOString();

      // Submit systolic
      await fetch("/api/readings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patient_id: patientId,
          condition_type: "hypertension",
          reading_type: "systolic",
          value: sysNum,
          unit: "mmHg",
          note: note || null,
          source: "clinician",
          recorded_at: now,
        }),
      });

      // Submit diastolic
      await fetch("/api/readings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patient_id: patientId,
          condition_type: "hypertension",
          reading_type: "diastolic",
          value: diaNum,
          unit: "mmHg",
          note: note || null,
          source: "clinician",
          recorded_at: now,
        }),
      });

      // Submit pulse if provided
      if (pulseNum) {
        await fetch("/api/readings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            patient_id: patientId,
            condition_type: "hypertension",
            reading_type: "pulse",
            value: pulseNum,
            unit: "bpm",
            source: "clinician",
            recorded_at: now,
          }),
        });
      }

      setSystolic("");
      setDiastolic("");
      setPulse("");
      setNote("");
      setSuccess("Blood pressure logged successfully");
      await fetchReadings();
      onAlertUpdated();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Weekly averages
  const past7DaysSys = readings.filter((r) => {
    const diff = (Date.now() - new Date(r.recorded_at).getTime()) / (1000 * 60 * 60 * 24);
    return diff <= 7 && r.reading_type === "systolic";
  });
  const past7DaysDia = readings.filter((r) => {
    const diff = (Date.now() - new Date(r.recorded_at).getTime()) / (1000 * 60 * 60 * 24);
    return diff <= 7 && r.reading_type === "diastolic";
  });
  const past7DaysPulse = readings.filter((r) => {
    const diff = (Date.now() - new Date(r.recorded_at).getTime()) / (1000 * 60 * 60 * 24);
    return diff <= 7 && r.reading_type === "pulse";
  });

  const avgSys =
    past7DaysSys.length > 0
      ? Math.round(past7DaysSys.reduce((acc, r) => acc + Number(r.value), 0) / past7DaysSys.length)
      : null;
  const avgDia =
    past7DaysDia.length > 0
      ? Math.round(past7DaysDia.reduce((acc, r) => acc + Number(r.value), 0) / past7DaysDia.length)
      : null;
  const avgPulse =
    past7DaysPulse.length > 0
      ? Math.round(past7DaysPulse.reduce((acc, r) => acc + Number(r.value), 0) / past7DaysPulse.length)
      : null;

  // Build combined chronological chart data
  const timeMap = new Map<string, { time: string; systolic?: number; diastolic?: number; pulse?: number }>();
  [...readings].reverse().forEach((r) => {
    const timeKey = new Date(r.recorded_at).toLocaleDateString("en-IN", {
      month: "short",
      day: "numeric",
    });
    if (!timeMap.has(timeKey)) {
      timeMap.set(timeKey, { time: timeKey });
    }
    const entry = timeMap.get(timeKey)!;
    if (r.reading_type === "systolic") entry.systolic = Number(r.value);
    if (r.reading_type === "diastolic") entry.diastolic = Number(r.value);
    if (r.reading_type === "pulse") entry.pulse = Number(r.value);
  });
  const chartData = Array.from(timeMap.values());

  const openBpAlerts = alerts.filter(
    (a) => a.condition_type === "hypertension" && a.status === "open"
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Top Metrics Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
        {/* Weekly BP Average */}
        <div style={{
          background: "#EDF7FE",
          border: "1.5px solid #7DD3FC",
          borderRadius: 14,
          padding: "20px 24px",
          boxShadow: "0 4px 16px rgba(12, 133, 208, 0.1)"
        }}>
          <p style={{ margin: "0 0 6px", fontSize: 13, fontWeight: 700, color: "#12578A" }}>
            Weekly BP Average
          </p>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <span style={{
              fontSize: 32,
              fontWeight: 800,
              color: avgSys && (avgSys >= 140 || (avgDia && avgDia >= 90)) ? "#D97706" : "#083457"
            }}>
              {avgSys && avgDia ? `${avgSys}/${avgDia}` : "—"}
            </span>
            <span style={{ fontSize: 14, color: "#12578A", fontWeight: 700 }}>mmHg</span>
          </div>
          <p style={{ margin: "6px 0 0", fontSize: 12, color: "#12578A" }}>
            Threshold target &lt; 140/90 mmHg
          </p>
        </div>

        {/* Resting Heart Rate */}
        <div style={{
          background: "#EDF7FE",
          border: "1.5px solid #7DD3FC",
          borderRadius: 14,
          padding: "20px 24px",
          boxShadow: "0 4px 16px rgba(12, 133, 208, 0.1)"
        }}>
          <p style={{ margin: "0 0 6px", fontSize: 13, fontWeight: 700, color: "#12578A" }}>
            Average Pulse Rate
          </p>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <span style={{ fontSize: 32, fontWeight: 800, color: "#083457" }}>
              {avgPulse ?? "—"}
            </span>
            <span style={{ fontSize: 14, color: "#12578A", fontWeight: 700 }}>bpm</span>
          </div>
          <p style={{ margin: "6px 0 0", fontSize: 12, color: "#12578A" }}>
            Normal resting range 60 - 100 bpm
          </p>
        </div>

        {/* Active Alerts */}
        <div style={{
          background: openBpAlerts.length > 0 ? "#FEE2E2" : "#E0F2FE",
          border: `1.5px solid ${openBpAlerts.length > 0 ? "#FCA5A5" : "#7DD3FC"}`,
          borderRadius: 14,
          padding: "20px 24px",
          boxShadow: "0 4px 16px rgba(12, 133, 208, 0.1)"
        }}>
          <p style={{ margin: "0 0 6px", fontSize: 13, fontWeight: 700, color: openBpAlerts.length > 0 ? "#991B1B" : "#083457" }}>
            Active Hypertension Alerts
          </p>
          <span style={{ fontSize: 32, fontWeight: 800, color: openBpAlerts.length > 0 ? "#DC2626" : "#083457" }}>
            {openBpAlerts.length}
          </span>
          <p style={{ margin: "6px 0 0", fontSize: 12, color: openBpAlerts.length > 0 ? "#B91C1C" : "#12578A" }}>
            {openBpAlerts.length > 0 ? openBpAlerts[0].message : "Normal blood pressure monitored"}
          </p>
        </div>
      </div>

      {/* Main Grid: Chart + Quick Add */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 24, alignItems: "start" }}>
        {/* Trend Chart */}
        <div style={{
          background: "#EDF7FE",
          border: "1.5px solid #7DD3FC",
          borderRadius: 16,
          padding: "24px",
          boxShadow: "0 4px 20px rgba(12, 133, 208, 0.12)"
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: "#083457" }}>
                Blood Pressure Trends (Systolic / Diastolic)
              </h3>
              <p style={{ margin: "4px 0 0", fontSize: 13, color: "#12578A" }}>
                Target: &lt; 140/90 mmHg (warning) · &gt;= 180/120 (crisis)
              </p>
            </div>
            <div style={{ display: "flex", gap: 12, fontSize: 12, fontWeight: 700 }}>
              <span style={{ display: "flex", alignItems: "center", gap: 6, color: "#EF4444" }}>
                <span style={{ width: 10, height: 10, borderRadius: 2, background: "#EF4444" }} /> Systolic
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: 6, color: "#1DA1F2" }}>
                <span style={{ width: 10, height: 10, borderRadius: 2, background: "#1DA1F2" }} /> Diastolic
              </span>
            </div>
          </div>

          {loading ? (
            <div style={{ height: 320, display: "flex", alignItems: "center", justifyContent: "center", color: "#12578A", fontWeight: 600 }}>
              Loading BP history...
            </div>
          ) : chartData.length === 0 ? (
            <div style={{ height: 320, display: "flex", alignItems: "center", justifyContent: "center", color: "#12578A", textAlign: "center" }}>
              No readings yet. Add the first one on the right.
            </div>
          ) : (
            <div style={{ height: 340 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#BAE6FD" />
                  <XAxis dataKey="time" stroke="#12578A" fontSize={12} tickLine={false} />
                  <YAxis stroke="#12578A" fontSize={12} domain={[50, 200]} tickLine={false} />
                  <Tooltip
                    contentStyle={{ background: "#F0F9FF", borderRadius: 8, border: "1.5px solid #7DD3FC", fontSize: 13, color: "#083457" }}
                  />
                  {/* Thresholds */}
                  <ReferenceLine y={180} stroke="#EF4444" strokeDasharray="4 4" label={{ value: "Urgent Crisis (180)", fill: "#DC2626", fontSize: 11 }} />
                  <ReferenceLine y={140} stroke="#F59E0B" strokeDasharray="4 4" label={{ value: "High Systolic (140)", fill: "#D97706", fontSize: 11 }} />
                  <ReferenceLine y={90} stroke="#F59E0B" strokeDasharray="4 4" label={{ value: "High Diastolic (90)", fill: "#D97706", fontSize: 11 }} />
                  <Line
                    type="monotone"
                    dataKey="systolic"
                    name="Systolic"
                    stroke="#EF4444"
                    strokeWidth={3}
                    dot={{ fill: "#EF4444", r: 4 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="diastolic"
                    name="Diastolic"
                    stroke="#1DA1F2"
                    strokeWidth={3}
                    dot={{ fill: "#1DA1F2", r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Quick Add Form */}
        <div style={{
          background: "#EDF7FE",
          border: "1.5px solid #7DD3FC",
          borderRadius: 16,
          padding: "24px",
          boxShadow: "0 4px 20px rgba(12, 133, 208, 0.12)"
        }}>
          <h3 style={{ margin: "0 0 6px", fontSize: 16, fontWeight: 800, color: "#083457" }}>
            Log Blood Pressure
          </h3>
          <p style={{ margin: "0 0 20px", fontSize: 13, color: "#12578A" }}>
            Record cuff check (Systolic / Diastolic).
          </p>

          {error && (
            <div style={{ background: "#FEE2E2", color: "#DC2626", padding: "10px 12px", borderRadius: 8, fontSize: 13, marginBottom: 16 }}>
              {error}
            </div>
          )}
          {success && (
            <div style={{ background: "#E0F2FE", border: "1px solid #7DD3FC", color: "#083457", padding: "10px 12px", borderRadius: 8, fontSize: 13, marginBottom: 16, fontWeight: 700 }}>
              {success}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#083457", marginBottom: 6 }}>
                  Systolic (Top)
                </label>
                <input
                  type="number"
                  min="50"
                  max="260"
                  placeholder="e.g. 135"
                  value={systolic}
                  onChange={(e) => setSystolic(e.target.value)}
                  required
                  style={{
                    width: "100%",
                    padding: "12px 14px",
                    borderRadius: 10,
                    border: "1.5px solid #7DD3FC",
                    background: "#F0F9FF",
                    color: "#083457",
                    fontSize: 16,
                    fontWeight: 700,
                    outline: "none",
                  }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#083457", marginBottom: 6 }}>
                  Diastolic (Bottom)
                </label>
                <input
                  type="number"
                  min="30"
                  max="160"
                  placeholder="e.g. 85"
                  value={diastolic}
                  onChange={(e) => setDiastolic(e.target.value)}
                  required
                  style={{
                    width: "100%",
                    padding: "12px 14px",
                    borderRadius: 10,
                    border: "1.5px solid #7DD3FC",
                    background: "#F0F9FF",
                    color: "#083457",
                    fontSize: 16,
                    fontWeight: 700,
                    outline: "none",
                  }}
                />
              </div>
            </div>

            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#083457", marginBottom: 6 }}>
                Pulse (bpm, optional)
              </label>
              <input
                type="number"
                min="30"
                max="220"
                placeholder="e.g. 72"
                value={pulse}
                onChange={(e) => setPulse(e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: 10,
                  border: "1.5px solid #7DD3FC",
                  background: "#F0F9FF",
                  color: "#083457",
                  fontSize: 14,
                  outline: "none",
                }}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#083457", marginBottom: 6 }}>
                Clinical Note (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. Taken seated after 5m rest"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: 10,
                  border: "1.5px solid #7DD3FC",
                  background: "#F0F9FF",
                  color: "#083457",
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
                background: "linear-gradient(135deg, #1DA1F2 0%, #0C85D0 100%)",
                color: "#fff",
                border: "none",
                borderRadius: 10,
                fontSize: 15,
                fontWeight: 800,
                cursor: submitting ? "not-allowed" : "pointer",
                opacity: submitting ? 0.7 : 1,
                boxShadow: "0 4px 14px rgba(12,133,208,0.3)",
              }}
            >
              {submitting ? "Saving..." : "+ Save BP Reading"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
