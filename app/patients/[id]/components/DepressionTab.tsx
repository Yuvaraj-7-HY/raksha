// app/patients/[id]/components/DepressionTab.tsx
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
import type { MoodCheck, ConditionAlert } from "@/types/conditions";
import { HELPLINE_NUMBER } from "@/types/conditions";

// Standard PHQ Questions
const PHQ_QUESTIONS = [
  "1. Little interest or pleasure in doing things",
  "2. Feeling down, depressed, or hopeless",
  "3. Trouble falling or staying asleep, or sleeping too much",
  "4. Feeling tired or having little energy",
  "5. Poor appetite or overeating",
  "6. Feeling bad about yourself — or that you are a failure or have let yourself or your family down",
  "7. Trouble concentrating on things, such as reading or watching television",
  "8. Moving or speaking so slowly that other people have noticed, or being fidgety/restless",
  "9. Thoughts that you would be better off dead, or of hurting yourself in some way",
];

const ANSWER_OPTIONS = [
  { label: "Not at all (0)", value: 0 },
  { label: "Several days (1)", value: 1 },
  { label: "More than half the days (2)", value: 2 },
  { label: "Nearly every day (3)", value: 3 },
];

export function DepressionTab({
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
  const [checks, setChecks] = useState<MoodCheck[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Questionnaire state: answers for questions 1 through 9
  const [answers, setAnswers] = useState<number[]>([0, 0, 0, 0, 0, 0, 0, 0, 0]);

  // Safety trigger state (Q9 > 0)
  const [showHelplineModal, setShowHelplineModal] = useState(false);

  const fetchChecks = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/mood-checks?patient_id=${patientId}&limit=10`);
      const data = await res.json();
      if (data.checks) {
        setChecks(data.checks);
      }
    } catch (err: any) {
      console.error("Error fetching mood checks:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchChecks();
  }, [patientId]);

  const handleAnswerChange = (qIndex: number, val: number) => {
    const updated = [...answers];
    updated[qIndex] = val;
    setAnswers(updated);
  };

  // PHQ-2 score is Q1 + Q2
  const phq2Score = answers[0] + answers[1];
  // Expand to PHQ-9 if PHQ-2 score >= 3
  const isExpandedToPhq9 = phq2Score >= 3;

  const totalScore = isExpandedToPhq9
    ? answers.reduce((a, b) => a + b, 0)
    : phq2Score;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const questionnaireType = isExpandedToPhq9 ? "phq9" : "phq2";
    const submittedAnswers = isExpandedToPhq9 ? answers : [answers[0], answers[1]];

    try {
      setSubmitting(true);
      const res = await fetch("/api/mood-checks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patient_id: patientId,
          questionnaire: questionnaireType,
          answers: submittedAnswers,
          total_score: totalScore,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to submit mood check");
      }

      if (data.safety_flow_triggered || (isExpandedToPhq9 && answers[8] > 0)) {
        setShowHelplineModal(true);
      } else {
        setSuccess("Mood check recorded successfully");
      }

      setAnswers([0, 0, 0, 0, 0, 0, 0, 0, 0]);
      await fetchChecks();
      onAlertUpdated();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const chartData = [...checks].reverse().map((c) => ({
    date: new Date(c.created_at).toLocaleDateString("en-IN", {
      month: "short",
      day: "numeric",
    }),
    score: c.total_score,
    type: c.questionnaire.toUpperCase(),
  }));

  const openDepressionAlerts = alerts.filter(
    (a) => a.condition_type === "depression" && a.status === "open"
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Restricted Privacy Banner */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        background: "#F5F3FF",
        border: "1px solid #DDD6FE",
        borderRadius: 12,
        padding: "12px 18px",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{
            background: "#5B21B6",
            color: "#fff",
            fontSize: 11,
            fontWeight: 800,
            padding: "3px 8px",
            borderRadius: 6,
            letterSpacing: "0.04em"
          }}>
            RESTRICTED: CARE TEAM ONLY
          </span>
          <span style={{ fontSize: 13, color: "#4C1D95", fontWeight: 500 }}>
            Depression screening and questionnaire scores are strictly confidential.
          </span>
        </div>
        <span style={{ fontSize: 12, color: "#7C3AED", fontWeight: 600 }}>PHQ Screenings</span>
      </div>

      {/* Main Grid: Score Trend Chart + Weekly Mood Check Form */}
      <div style={{ display: "grid", gridTemplateColumns: "1.8fr 1.2fr", gap: 24, alignItems: "start" }}>
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
                PHQ Mood Score Trend
              </h3>
              <p style={{ margin: "4px 0 0", fontSize: 13, color: "#6B7280" }}>
                PHQ-9 Thresholds: 10-14 (moderate warning), &gt;= 15 (severe urgent)
              </p>
            </div>
            {openDepressionAlerts.length > 0 && (
              <span style={{ background: "#FEE2E2", color: "#DC2626", padding: "4px 10px", borderRadius: 8, fontSize: 12, fontWeight: 700 }}>
                {openDepressionAlerts.length} Active Alerts
              </span>
            )}
          </div>

          {loading ? (
            <div style={{ height: 320, display: "flex", alignItems: "center", justifyContent: "center", color: "#9CA3AF" }}>
              Loading mood history...
            </div>
          ) : chartData.length === 0 ? (
            <div style={{ height: 320, display: "flex", alignItems: "center", justifyContent: "center", color: "#9CA3AF", textAlign: "center" }}>
              No mood checks yet. Start with the weekly check on the right.
            </div>
          ) : (
            <div style={{ height: 340 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                  <XAxis dataKey="date" stroke="#9CA3AF" fontSize={12} tickLine={false} />
                  <YAxis stroke="#9CA3AF" fontSize={12} domain={[0, 27]} tickLine={false} />
                  <Tooltip contentStyle={{ background: "#fff", borderRadius: 8, border: "1px solid #E5E7EB", fontSize: 13 }} />
                  <ReferenceLine y={15} stroke="#DC2626" strokeDasharray="4 4" label={{ value: "Urgent (15)", fill: "#DC2626", fontSize: 11 }} />
                  <ReferenceLine y={10} stroke="#F59E0B" strokeDasharray="4 4" label={{ value: "Moderate (10)", fill: "#D97706", fontSize: 11 }} />
                  <Line
                    type="monotone"
                    dataKey="score"
                    name="PHQ Score"
                    stroke="#7C3AED"
                    strokeWidth={3}
                    dot={{ fill: "#7C3AED", r: 5 }}
                    activeDot={{ r: 7 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Weekly Mood Check Questionnaire Form */}
        <div style={{
          background: "#fff",
          border: "1px solid #E5E7EB",
          borderRadius: 16,
          padding: "24px",
          boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
          maxHeight: 680,
          overflowY: "auto",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 16 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#111827" }}>
                Weekly Mood Check
              </h3>
              <p style={{ margin: "2px 0 0", fontSize: 12, color: "#6B7280" }}>
                {isExpandedToPhq9 ? "Expanded to Full PHQ-9 (Score >= 3)" : "PHQ-2 Initial Screener"}
              </p>
            </div>
            <span style={{ fontSize: 14, fontWeight: 700, color: totalScore >= 10 ? "#DC2626" : "#0D9488" }}>
              Score: {totalScore}
            </span>
          </div>

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

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Show first 2 questions always, and questions 3-9 if expanded */}
            {PHQ_QUESTIONS.slice(0, isExpandedToPhq9 ? 9 : 2).map((q, idx) => {
              const isQ9 = idx === 8;
              return (
                <div
                  key={idx}
                  style={{
                    padding: "10px 12px",
                    borderRadius: 10,
                    background: isQ9 ? "#FEF2F2" : "#F9FAFB",
                    border: `1px solid ${isQ9 ? "#FCA5A5" : "#E5E7EB"}`,
                  }}
                >
                  <p style={{
                    margin: "0 0 8px",
                    fontSize: 13,
                    fontWeight: 600,
                    color: isQ9 ? "#991B1B" : "#374151",
                    lineHeight: 1.4,
                  }}>
                    {q} {isQ9 && <span style={{ color: "#DC2626", fontWeight: 700 }}>(Safety Alert Question)</span>}
                  </p>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                    {ANSWER_OPTIONS.map((opt) => (
                      <button
                        type="button"
                        key={opt.value}
                        onClick={() => handleAnswerChange(idx, opt.value)}
                        style={{
                          padding: "6px 8px",
                          borderRadius: 6,
                          border: `1.5px solid ${answers[idx] === opt.value ? "#0D9488" : "#E5E7EB"}`,
                          background: answers[idx] === opt.value ? "#CCFBF1" : "#fff",
                          color: answers[idx] === opt.value ? "#0F766E" : "#4B5563",
                          fontSize: 12,
                          fontWeight: answers[idx] === opt.value ? 700 : 500,
                          cursor: "pointer",
                          textAlign: "left",
                        }}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}

            {!isExpandedToPhq9 && phq2Score < 3 && (
              <p style={{ margin: "4px 0", fontSize: 12, color: "#6B7280", fontStyle: "italic" }}>
                PHQ-2 score is &lt; 3. Normal screening. If score was &gt;= 3, questionnaire would expand to full PHQ-9.
              </p>
            )}

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
              {submitting ? "Submitting..." : "+ Save Mood Screening"}
            </button>
          </form>
        </div>
      </div>

      {/* PART 4: DEPRESSION SAFETY SCREEN MODAL (Q9 > 0) */}
      {showHelplineModal && (
        <div style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.6)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 9999,
          padding: 20,
        }}>
          <div style={{
            background: "#fff",
            borderRadius: 20,
            maxWidth: 520,
            width: "100%",
            padding: 32,
            boxShadow: "0 20px 40px rgba(0,0,0,0.2)",
            textAlign: "center",
          }}>
            <div style={{
              width: 64,
              height: 64,
              borderRadius: "50%",
              background: "#FEE2E2",
              color: "#DC2626",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 32,
              margin: "0 auto 16px",
            }}>
              ❤️
            </div>

            <h2 style={{ margin: "0 0 10px", fontSize: 22, fontWeight: 800, color: "#111827" }}>
              We Are Here With You
            </h2>

            <p style={{ margin: "0 0 20px", fontSize: 14, color: "#4B5563", lineHeight: 1.6 }}>
              Thank you for sharing your feelings. Your safety and well-being matter deeply.
              The care team and family have been notified to check in right away.
            </p>

            {/* Helpline Box */}
            <div style={{
              background: "#F0FDFA",
              border: "2px solid #0D9488",
              borderRadius: 14,
              padding: "20px 24px",
              marginBottom: 24,
            }}>
              <p style={{ margin: "0 0 6px", fontSize: 13, fontWeight: 700, color: "#0F766E", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                24/7 National Mental Health Helpline
              </p>
              <div style={{ fontSize: 28, fontWeight: 900, color: "#0D9488" }}>
                {HELPLINE_NUMBER}
              </div>
              <p style={{ margin: "6px 0 0", fontSize: 12, color: "#6B7280" }}>
                Toll-free · Tele-MANAS (Govt. of India) &amp; Crisis Support
              </p>
            </div>

            <button
              onClick={() => setShowHelplineModal(false)}
              style={{
                width: "100%",
                padding: "12px 20px",
                background: "#0D9488",
                color: "#fff",
                border: "none",
                borderRadius: 10,
                fontSize: 15,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              I Understand — Return to Dashboard
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
