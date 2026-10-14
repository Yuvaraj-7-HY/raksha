// app/patients/[id]/components/OverviewTimeline.tsx
"use client";

import { useState, useEffect } from "react";
import { formatIstDateTime } from "@/lib/istDate";
import type { ConditionAlert } from "@/types/conditions";

interface TimelineEvent {
  id: string;
  type: "call" | "vital" | "caregiver" | "mood" | "alert";
  title: string;
  subtitle: string;
  timestamp: string;
  severity?: "normal" | "warning" | "urgent" | "info";
  badgeText: string;
  badgeBg: string;
  badgeColor: string;
}

export function OverviewTimeline({
  patientId,
  callAttempts = [],
  alerts = [],
}: {
  patientId: string;
  callAttempts?: any[];
  alerts?: ConditionAlert[];
}) {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadTimeline() {
      try {
        setLoading(true);

        // Fetch recent readings
        const [readingsRes, logsRes, moodRes] = await Promise.all([
          fetch(`/api/readings?patient_id=${patientId}&limit=30`).then((r) => r.json()),
          fetch(`/api/caregiver-logs?patient_id=${patientId}&limit=10`).then((r) => r.json()),
          fetch(`/api/mood-checks?patient_id=${patientId}&limit=10`).then((r) => r.json()),
        ]);

        const combined: TimelineEvent[] = [];

        // 1. Call attempts
        callAttempts.forEach((c) => {
          let badgeBg = "#F0FDF4";
          let badgeColor = "#16A34A";
          if (["no-answer", "failed", "busy"].includes(c.outcome)) {
            badgeBg = "#FEF2F2";
            badgeColor = "#DC2626";
          } else if (c.outcome === "unclear") {
            badgeBg = "#FFFBEB";
            badgeColor = "#D97706";
          }

          combined.push({
            id: `call_${c.id}`,
            type: "call",
            title: `Voice Call: ${c.outcome.toUpperCase()}`,
            subtitle: c.is_recheck ? "Scheduled re-check attempt" : `Attempt #${c.attempt_number || 1}`,
            timestamp: c.created_at,
            badgeText: "Phone IVR",
            badgeBg,
            badgeColor,
          });
        });

        // 2. Vitals readings
        if (readingsRes.readings) {
          readingsRes.readings.forEach((r: any) => {
            const label = r.reading_type.replace("_", " ").toUpperCase();
            combined.push({
              id: `vital_${r.id}`,
              type: "vital",
              title: `${label}: ${r.value} ${r.unit}`,
              subtitle: r.note ? `Note: ${r.note} (Source: ${r.source})` : `Source: ${r.source}`,
              timestamp: r.recorded_at,
              badgeText: r.condition_type,
              badgeBg: "#CCFBF1",
              badgeColor: "#0F766E",
            });
          });
        }

        // 3. Caregiver logs
        if (logsRes.logs) {
          logsRes.logs.forEach((l: any) => {
            combined.push({
              id: `log_${l.id}`,
              type: "caregiver",
              title: `Caregiver Log: Confusion ${l.confusion_level}/5 · Sleep ${l.sleep_quality}/5`,
              subtitle: `Logged by ${l.logged_by}${l.agitation_or_wandering ? " · Agitation flagged" : ""}${l.notes ? ` · "${l.notes}"` : ""}`,
              timestamp: l.created_at,
              badgeText: "Dementia",
              badgeBg: "#FEF3C7",
              badgeColor: "#B45309",
            });
          });
        }

        // 4. Mood checks
        if (moodRes.checks) {
          moodRes.checks.forEach((m: any) => {
            combined.push({
              id: `mood_${m.id}`,
              type: "mood",
              title: `${m.questionnaire.toUpperCase()} Mood Screening: Score ${m.total_score}`,
              subtitle: m.total_score >= 10 ? "Moderate to severe range" : "Mild / normal range",
              timestamp: m.created_at,
              badgeText: "Depression",
              badgeBg: "#EDE9FE",
              badgeColor: "#6D28D9",
            });
          });
        }

        // 5. Condition alerts
        alerts.forEach((a) => {
          combined.push({
            id: `alt_${a.id}`,
            type: "alert",
            title: `Alert: ${a.message}`,
            subtitle: `Severity: ${a.severity.toUpperCase()} · Status: ${a.status}`,
            timestamp: a.created_at,
            badgeText: a.severity.toUpperCase(),
            badgeBg: a.severity === "urgent" ? "#FEE2E2" : "#FEF3C7",
            badgeColor: a.severity === "urgent" ? "#DC2626" : "#D97706",
          });
        });

        // Sort chronological descending (newest first)
        combined.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        setEvents(combined);
      } catch (err) {
        console.error("Error loading timeline:", err);
      } finally {
        setLoading(false);
      }
    }

    loadTimeline();
  }, [patientId, callAttempts, alerts]);

  return (
    <div style={{ background: "#EDF7FE", border: "1.5px solid #7DD3FC", borderRadius: 16, padding: "24px", boxShadow: "0 4px 20px rgba(12, 133, 208, 0.12)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: "#083457" }}>
            Patient Clinical &amp; Care Timeline
          </h3>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "#12578A" }}>
            Combined stream of call responses, vitals readings, caregiver logs, and condition alerts.
          </p>
        </div>
        <span style={{ fontSize: 12, background: "#BAE6FD", color: "#083457", padding: "4px 10px", borderRadius: 8, fontWeight: 700, border: "1px solid #7DD3FC" }}>
          {events.length} Events Logged
        </span>
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: "center", color: "#12578A", fontWeight: 600 }}>Loading timeline events...</div>
      ) : events.length === 0 ? (
        <div style={{ padding: 40, textAlign: "center", color: "#12578A" }}>
          No activity recorded yet for this patient.
        </div>
      ) : (
        <div style={{ position: "relative", paddingLeft: 24 }}>
          {/* Vertical timeline line */}
          <div style={{
            position: "absolute",
            left: 7,
            top: 8,
            bottom: 8,
            width: 2,
            background: "#7DD3FC",
          }} />

          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {events.map((ev) => (
              <div key={ev.id} style={{ position: "relative", display: "flex", alignItems: "flex-start", gap: 14 }}>
                {/* Node dot */}
                <div style={{
                  position: "absolute",
                  left: -24,
                  top: 4,
                  width: 16,
                  height: 16,
                  borderRadius: "50%",
                  background: "#EDF7FE",
                  border: `3px solid ${ev.type === "alert" ? "#EF4444" : ev.type === "vital" ? "#0EA5E9" : "#1DA1F2"}`,
                }} />

                <div style={{
                  flex: 1,
                  background: "#E0F2FE",
                  border: "1.5px solid #BAE6FD",
                  borderRadius: 12,
                  padding: "12px 16px",
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{
                        padding: "2px 8px",
                        borderRadius: 6,
                        fontSize: 11,
                        fontWeight: 700,
                        background: ev.badgeBg,
                        color: ev.badgeColor,
                        textTransform: "uppercase",
                      }}>
                        {ev.badgeText}
                      </span>
                      <span style={{ fontSize: 14, fontWeight: 800, color: "#083457" }}>
                        {ev.title}
                      </span>
                    </div>
                    <span style={{ fontSize: 12, color: "#12578A", fontWeight: 600 }}>
                      {formatIstDateTime(ev.timestamp)}
                    </span>
                  </div>
                  <p style={{ margin: 0, fontSize: 13, color: "#12578A" }}>
                    {ev.subtitle}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
