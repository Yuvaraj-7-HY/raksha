"use client";

import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import Link from "next/link";
import {
  getTodayDoses,
  updateDoseStatus,
  snoozeDose,
  undoDose,
  resetTodayDoses,
  calculateAdherenceStats,
  getPatients,
} from "@/lib/storage";
import type { ScheduledDose, DoseStatus, DosePeriod, Patient, AdherenceStats } from "@/types";

// ── Key used to track which dose IDs have already had an auto-call today ──
const CALLED_TODAY_KEY = "raksha_autocalled_doses_" + new Date().toDateString();

// Parse a timeSlot string like "08:00 AM" or "2:30 PM" into today's Date
function parseTimeSlotToDate(timeSlot: string): Date | null {
  try {
    const match = timeSlot.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (!match) return null;
    let hours = parseInt(match[1], 10);
    const minutes = parseInt(match[2], 10);
    const meridiem = match[3].toUpperCase();
    if (meridiem === "AM" && hours === 12) hours = 0;
    if (meridiem === "PM" && hours !== 12) hours += 12;
    const d = new Date();
    d.setHours(hours, minutes, 0, 0);
    return d;
  } catch {
    return null;
  }
}

type CallStatus = "idle" | "calling" | "called" | "failed";

export default function TodayScreenPage() {
  const [doses, setDoses] = useState<ScheduledDose[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState<string>("all");
  const [selectedPeriodFilter, setSelectedPeriodFilter] = useState<"all" | DosePeriod>("all");
  const [activeSnoozeModalDose, setActiveSnoozeModalDose] = useState<ScheduledDose | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  // Map of doseId -> CallStatus for call badge display
  const [callStatusMap, setCallStatusMap] = useState<Record<string, CallStatus>>({});
  // Set of dose IDs that have already been auto-called today (persisted to localStorage)
  const calledTodayRef = useRef<Set<string>>(new Set());

  // Load from local storage on mount
  useEffect(() => {
    const loadedPatients = getPatients();
    setPatients(loadedPatients);
    const loadedDoses = getTodayDoses();
    setDoses(loadedDoses);
    // Restore today's already-called set from localStorage
    try {
      const stored = localStorage.getItem(CALLED_TODAY_KEY);
      if (stored) {
        calledTodayRef.current = new Set(JSON.parse(stored));
        // Pre-populate callStatusMap
        const map: Record<string, CallStatus> = {};
        calledTodayRef.current.forEach((id) => { map[id] = "called"; });
        setCallStatusMap(map);
      }
    } catch { /* ignore */ }
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // ── Actions ────────────────────────────────────────────────────────────────
  const handleMarkTaken = (id: string) => {
    const updated = updateDoseStatus(id, "taken");
    if (updated) {
      setDoses(getTodayDoses());
      showToast(`✓ Marked ${updated.medicineName} as Taken!`);
    }
  };

  const handleSnooze = (id: string, minutes: number) => {
    const updated = snoozeDose(id, minutes);
    if (updated) {
      setDoses(getTodayDoses());
      setActiveSnoozeModalDose(null);
      showToast(`⏰ Snoozed ${updated.medicineName} to ${updated.timeSlot}`);
    }
  };

  const handleMarkSkip = (id: string) => {
    const updated = updateDoseStatus(id, "skipped");
    if (updated) {
      setDoses(getTodayDoses());
      showToast(`Skipped ${updated.medicineName}`);
    }
  };

  const handleMarkMissed = (id: string) => {
    const updated = updateDoseStatus(id, "missed");
    if (updated) {
      setDoses(getTodayDoses());
      showToast(`Marked ${updated.medicineName} as Missed`);
    }
  };

  const handleUndo = (id: string) => {
    const updated = undoDose(id);
    if (updated) {
      setDoses(getTodayDoses());
      showToast(`Undid action for ${updated.medicineName}`);
    }
  };

  const handleResetDemo = () => {
    const fresh = resetTodayDoses();
    setDoses(fresh);
    // Clear auto-call tracking so demo can replay calls
    calledTodayRef.current = new Set();
    try { localStorage.removeItem(CALLED_TODAY_KEY); } catch { /* ignore */ }
    setCallStatusMap({});
    showToast("Reset all today's doses to original schedule!");
  };

  // ── Auto-Call: trigger a medication reminder call at scheduled dose time ──
  const triggerCallForDose = useCallback(async (dose: ScheduledDose, isManual = false) => {
    const patient = patients.find((p) => p.id === dose.patientId);
    const patientPhone = patient?.phone || "";
    const patientName = patient?.name || "Patient";

    if (!isManual) {
      // Don't re-call if already called today for this dose
      if (calledTodayRef.current.has(dose.id)) return;
      // Mark as called
      calledTodayRef.current.add(dose.id);
      try {
        const arr = Array.from(calledTodayRef.current);
        localStorage.setItem(CALLED_TODAY_KEY, JSON.stringify(arr));
      } catch { /* ignore */ }
    }

    // Update UI badge to "calling"
    setCallStatusMap((prev) => ({ ...prev, [dose.id]: "calling" }));
    showToast(`📞 Calling ${patientName} about ${dose.medicineName}...`);

    try {
      const res = await fetch("/api/call-patient", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId: dose.patientId,
          patientName,
          phone: patientPhone,
          doseId: dose.id,
          medicineName: dose.medicineName,
          dosage: dose.dosage,
          timeSlot: dose.timeSlot,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setCallStatusMap((prev) => ({ ...prev, [dose.id]: "called" }));
        showToast(`✅ Call placed to ${patientName} for ${dose.medicineName}`);
      } else {
        throw new Error(data.error || "Call failed");
      }
    } catch (err: any) {
      setCallStatusMap((prev) => ({ ...prev, [dose.id]: "failed" }));
      showToast(`❌ Call failed: ${err?.message || "Unknown error"}`);
      if (!isManual) {
        // Allow retry on next poll if auto-call fails
        calledTodayRef.current.delete(dose.id);
      }
    }
  }, [patients]);

  // ── Scheduler: poll every 30s, fire call if dose time is within ±2 min ──
  useEffect(() => {
    const checkAndCall = () => {
      const now = new Date();
      const currentDoses = getTodayDoses();
      for (const dose of currentDoses) {
        if (dose.status !== "pending") continue;
        if (calledTodayRef.current.has(dose.id)) continue;
        const doseTime = parseTimeSlotToDate(dose.timeSlot);
        if (!doseTime) continue;
        const diffMs = now.getTime() - doseTime.getTime();
        // Fire if dose time passed within last 2 minutes (0 to +120s window)
        if (diffMs >= 0 && diffMs <= 120_000) {
          triggerCallForDose(dose, false);
        }
      }
    };

    // Check immediately on mount, then every 30s
    checkAndCall();
    const interval = setInterval(checkAndCall, 30_000);
    return () => clearInterval(interval);
  }, [triggerCallForDose]);

  // ── Poll /api/dose-events every 5s — auto-update dose status from Twilio IVR ──
  useEffect(() => {
    const pollEvents = async () => {
      try {
        const res = await fetch("/api/dose-events");
        if (!res.ok) return;
        const data = await res.json();
        const events: Array<{ id: string; doseId: string; patientId: string; eventType: string; medicineName?: string }> = data.events || [];
        if (!events.length) return;

        const consumedIds: string[] = [];
        let didChange = false;

        for (const ev of events) {
          consumedIds.push(ev.id);
          if (ev.eventType === "taken") {
            const updated = updateDoseStatus(ev.doseId, "taken");
            if (updated) {
              didChange = true;
              showToast(`✅ ${updated.medicineName} marked as Taken (patient pressed 1)`);
            }
          } else if (ev.eventType === "snoozed") {
            // Reflect press-2 follow-up pending state in UI without changing dose status
            showToast(`⏰ ${ev.medicineName || "Medicine"} follow-up call scheduled (patient pressed 2)`);
          }
        }

        // Tell server these events are consumed
        if (consumedIds.length) {
          fetch("/api/dose-events", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ consume: consumedIds }),
          }).catch(() => {});
        }

        if (didChange) {
          setDoses(getTodayDoses());
        }
      } catch {
        // silently ignore network errors during polling
      }
    };

    const interval = setInterval(pollEvents, 5_000);
    // Also run once immediately
    pollEvents();
    return () => clearInterval(interval);
  }, []);

  // ── Filtered & Grouped Data ────────────────────────────────────────────────
  const filteredDoses = useMemo(() => {
    return doses.filter((d) => {
      const matchPatient = selectedPatientId === "all" || d.patientId === selectedPatientId;
      const matchPeriod = selectedPeriodFilter === "all" || d.period === selectedPeriodFilter;
      return matchPatient && matchPeriod;
    });
  }, [doses, selectedPatientId, selectedPeriodFilter]);

  // Group by timeSlot e.g. "08:00 AM", sorted chronologically
  const groupedDoses = useMemo(() => {
    const map = new Map<string, ScheduledDose[]>();
    const sorted = [...filteredDoses].sort((a, b) =>
      a.scheduledTime.localeCompare(b.scheduledTime)
    );
    for (const d of sorted) {
      const list = map.get(d.timeSlot) || [];
      list.push(d);
      map.set(d.timeSlot, list);
    }
    return Array.from(map.entries());
  }, [filteredDoses]);

  // Stats calculation
  const stats: AdherenceStats = useMemo(() => {
    return calculateAdherenceStats(
      selectedPatientId === "all" ? doses : doses.filter((d) => d.patientId === selectedPatientId)
    );
  }, [doses, selectedPatientId]);

  const allCompleted =
    stats.totalDoses > 0 && stats.pendingCount === 0 && stats.snoozedCount === 0;

  // Format today's date
  const todayFormatted = useMemo(() => {
    return new Date().toLocaleDateString("en-US", {
      weekday: "long",
      month: "short",
      day: "numeric",
    });
  }, []);

  // Helper for current period
  const currentPeriod = useMemo<DosePeriod>(() => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return "morning";
    if (hour >= 12 && hour < 17) return "afternoon";
    if (hour >= 17 && hour < 21) return "evening";
    return "night";
  }, []);

  const periodPendingCounts = useMemo(() => {
    const targetDoses =
      selectedPatientId === "all" ? doses : doses.filter((d) => d.patientId === selectedPatientId);
    return {
      morning: targetDoses.filter((d) => d.period === "morning" && (d.status === "pending" || d.status === "snoozed")).length,
      afternoon: targetDoses.filter((d) => d.period === "afternoon" && (d.status === "pending" || d.status === "snoozed")).length,
      evening: targetDoses.filter((d) => d.period === "evening" && (d.status === "pending" || d.status === "snoozed")).length,
      night: targetDoses.filter((d) => d.period === "night" && (d.status === "pending" || d.status === "snoozed")).length,
    };
  }, [doses, selectedPatientId]);

  return (
    <div className="flex min-h-dvh" style={{ background: "var(--bg, #F8FAFC)", fontFamily: "var(--font-sans, system-ui, sans-serif)" }}>
      {/* ── Fixed Sidebar ──────────────────────────────────────────────────── */}
      <aside
        style={{
          width: 240,
          minWidth: 240,
          background: "var(--surface, #FFFFFF)",
          borderRight: "1px solid var(--border, #E5EAF0)",
          display: "flex",
          flexDirection: "column",
          position: "fixed",
          top: 0,
          left: 0,
          bottom: 0,
          zIndex: 40,
          padding: "0 12px",
          boxShadow: "var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.05))",
        }}
      >
        {/* Brand */}
        <div style={{ padding: "24px 8px 20px", borderBottom: "1px solid var(--border, #E5EAF0)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: 9,
                background: "#00C896",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.3">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
            </div>
            <div>
              <p style={{ fontSize: 15, fontWeight: 700, color: "#0F172A", margin: 0, letterSpacing: "-0.01em" }}>
                Raksha
              </p>
              <p style={{ fontSize: 11, color: "#64748B", margin: 0 }}>Medication Care</p>
            </div>
          </div>
        </div>

        {/* Nav Links */}
        <nav style={{ flex: 1, paddingTop: 16, display: "flex", flexDirection: "column", gap: 2 }}>
          <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", color: "#94A3B8", textTransform: "uppercase", padding: "0 14px 8px" }}>
            Daily Routine
          </p>
          <Link
            href="/today"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "10px 14px",
              borderRadius: 10,
              fontSize: 13,
              fontWeight: 700,
              textDecoration: "none",
              background: "#E6F9F4",
              color: "#008765",
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            Today&apos;s Schedule
            {stats.pendingCount > 0 && (
              <span
                style={{
                  marginLeft: "auto",
                  background: "#00C896",
                  color: "#fff",
                  fontSize: 11,
                  padding: "1px 7px",
                  borderRadius: 10,
                  fontWeight: 800,
                }}
              >
                {stats.pendingCount}
              </span>
            )}
          </Link>

          <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", color: "#94A3B8", textTransform: "uppercase", padding: "16px 14px 8px" }}>
            Care Platform
          </p>
          <Link
            href="/patients"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "10px 14px",
              borderRadius: 10,
              fontSize: 13,
              fontWeight: 600,
              textDecoration: "none",
              color: "#475569",
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
            Patients
          </Link>
          <Link
            href="/patients?tab=medications"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "10px 14px",
              borderRadius: 10,
              fontSize: 13,
              fontWeight: 600,
              textDecoration: "none",
              color: "#475569",
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
            Medications Hub
          </Link>
        </nav>

        {/* Live sync badge */}
        <div style={{ padding: "14px 8px 20px", borderTop: "1px solid #E5EAF0" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 12px",
              borderRadius: 8,
              background: "#E6F9F4",
            }}
          >
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: "50%",
                background: "#00C896",
                flexShrink: 0,
              }}
            />
            <div>
              <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: "#008765" }}>
                Adherence Tracking
              </p>
              <p style={{ margin: 0, fontSize: 10, color: "#64748B" }}>
                Active localStorage Sync
              </p>
            </div>
          </div>
        </div>
      </aside>

      {/* ── Main Content Area ──────────────────────────────────────────────── */}
      <main style={{ flex: 1, marginLeft: 240, minHeight: "100dvh", display: "flex", flexDirection: "column" }}>
        {/* Top Navbar */}
        <header
          style={{
            background: "#FFFFFF",
            borderBottom: "1px solid #E5EAF0",
            padding: "16px 32px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            position: "sticky",
            top: 0,
            zIndex: 30,
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: "#0F172A", letterSpacing: "-0.02em" }}>
                Today&apos;s Medication Routine
              </h1>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "4px 10px",
                  borderRadius: 20,
                  fontSize: 12,
                  fontWeight: 700,
                  background: "#F1F5F9",
                  color: "#475569",
                }}
              >
                📅 {todayFormatted}
              </span>
            </div>
            <p style={{ margin: "2px 0 0", fontSize: 13, color: "#64748B" }}>
              Time-grouped tablet schedule with instant dose recording
            </p>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {/* Patient Selector */}
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <label htmlFor="patient-select" style={{ fontSize: 12, fontWeight: 700, color: "#64748B" }}>
                Patient:
              </label>
              <select
                id="patient-select"
                value={selectedPatientId}
                onChange={(e) => setSelectedPatientId(e.target.value)}
                style={{
                  padding: "7px 12px",
                  borderRadius: 10,
                  border: "1.5px solid #CBD5E1",
                  fontSize: 13,
                  fontWeight: 600,
                  color: "#0F172A",
                  background: "#FFFFFF",
                  cursor: "pointer",
                }}
              >
                <option value="all">All Patients</option>
                {patients.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Reset Demo button */}
            <button
              onClick={handleResetDemo}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "8px 14px",
                borderRadius: 10,
                border: "1.5px solid #E2E8F0",
                background: "#FFFFFF",
                fontSize: 12,
                fontWeight: 700,
                color: "#475569",
                cursor: "pointer",
              }}
              title="Reset schedule to original pending dummy state"
            >
              🔄 Reset Demo
            </button>
          </div>
        </header>

        {/* Content body */}
        <div style={{ padding: "24px 32px", maxWidth: 1050, width: "100%", margin: "0 auto", flex: 1 }}>
          {/* ── Banner: Streaks & Adherence Score ──────────────────────────── */}
          <div
            style={{
              background: "linear-gradient(135deg, #00C896 0%, #009E77 100%)",
              borderRadius: 24,
              padding: "24px 28px",
              color: "#FFFFFF",
              boxShadow: "0 10px 25px -5px rgba(0, 200, 150, 0.25)",
              marginBottom: 24,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: 16,
            }}
          >
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                <span
                  style={{
                    background: "rgba(255, 255, 255, 0.22)",
                    padding: "4px 12px",
                    borderRadius: 20,
                    fontSize: 13,
                    fontWeight: 800,
                    letterSpacing: "0.02em",
                  }}
                >
                  🔥 {stats.streakDays}-Day Streak
                </span>
                <span
                  style={{
                    background: "#FFFFFF",
                    color: "#008765",
                    padding: "4px 12px",
                    borderRadius: 20,
                    fontSize: 13,
                    fontWeight: 900,
                  }}
                >
                  {stats.adherenceRate}% Adherence Score
                </span>
              </div>
              <h2 style={{ margin: "0 0 4px", fontSize: 24, fontWeight: 900, letterSpacing: "-0.02em" }}>
                {stats.pendingCount === 0
                  ? "Outstanding! All medicines taken today 🎉"
                  : `You have ${stats.pendingCount} ${stats.pendingCount === 1 ? "medicine" : "medicines"} to take today`}
              </h2>
              <p style={{ margin: 0, fontSize: 14, color: "rgba(255, 255, 255, 0.9)" }}>
                {stats.takenCount} of {stats.totalDoses} doses marked as taken. Tap buttons below as you consume your tablets.
              </p>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div
                style={{
                  background: "rgba(255, 255, 255, 0.18)",
                  borderRadius: 16,
                  padding: "12px 18px",
                  textAlign: "center",
                  minWidth: 90,
                }}
              >
                <div style={{ fontSize: 26, fontWeight: 900 }}>{stats.takenCount}</div>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", opacity: 0.9 }}>
                  Taken
                </div>
              </div>
              <div
                style={{
                  background: "rgba(255, 255, 255, 0.18)",
                  borderRadius: 16,
                  padding: "12px 18px",
                  textAlign: "center",
                  minWidth: 90,
                }}
              >
                <div style={{ fontSize: 26, fontWeight: 900 }}>{stats.pendingCount}</div>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", opacity: 0.9 }}>
                  Pending
                </div>
              </div>
              {stats.snoozedCount > 0 && (
                <div
                  style={{
                    background: "rgba(254, 243, 199, 0.3)",
                    borderRadius: 16,
                    padding: "12px 18px",
                    textAlign: "center",
                    minWidth: 90,
                    border: "1px solid rgba(254, 243, 199, 0.6)",
                  }}
                >
                  <div style={{ fontSize: 26, fontWeight: 900 }}>{stats.snoozedCount}</div>
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    Snoozed
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── Pillbox 4-Phase Summary Overview ───────────────────────────── */}
          <div
            style={{
              background: "#FFFFFF",
              borderRadius: 20,
              padding: "18px 20px",
              border: "1px solid #E2E8F0",
              boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
              marginBottom: 24,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 18 }}>💊</span>
                <span style={{ fontSize: 15, fontWeight: 800, color: "#0F172A" }}>
                  Pillbox Overview (4-Time Segments)
                </span>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <button
                  onClick={() => setSelectedPeriodFilter("all")}
                  style={{
                    padding: "4px 10px",
                    borderRadius: 8,
                    fontSize: 12,
                    fontWeight: 700,
                    border: "none",
                    cursor: "pointer",
                    background: selectedPeriodFilter === "all" ? "#00C896" : "#F1F5F9",
                    color: selectedPeriodFilter === "all" ? "#FFFFFF" : "#64748B",
                  }}
                >
                  View All
                </button>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
              {(
                [
                  { key: "morning", title: "Morning", time: "5 AM – 12 PM", icon: "🌅" },
                  { key: "afternoon", title: "Afternoon", time: "12 PM – 5 PM", icon: "☀️" },
                  { key: "evening", title: "Evening", time: "5 PM – 9 PM", icon: "🌆" },
                  { key: "night", title: "Night", time: "9 PM – 5 AM", icon: "🌙" },
                ] as const
              ).map((seg) => {
                const count = periodPendingCounts[seg.key];
                const isSelected = selectedPeriodFilter === seg.key;
                const isCurrent = currentPeriod === seg.key;

                return (
                  <div
                    key={seg.key}
                    onClick={() =>
                      setSelectedPeriodFilter(selectedPeriodFilter === seg.key ? "all" : seg.key)
                    }
                    style={{
                      padding: "14px",
                      borderRadius: 16,
                      background: isSelected ? "#F0FDF4" : "#F8FAFC",
                      border: isSelected
                        ? "2px solid #00C896"
                        : isCurrent
                        ? "1.5px solid #CBD5E1"
                        : "1px solid #E2E8F0",
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                      position: "relative",
                    }}
                  >
                    {isCurrent && (
                      <span
                        style={{
                          position: "absolute",
                          top: 8,
                          right: 8,
                          background: "#00C896",
                          color: "#fff",
                          fontSize: 9,
                          fontWeight: 800,
                          padding: "1px 6px",
                          borderRadius: 6,
                          textTransform: "uppercase",
                        }}
                      >
                        Now
                      </span>
                    )}
                    <div style={{ fontSize: 20, marginBottom: 4 }}>{seg.icon}</div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: "#0F172A" }}>{seg.title}</div>
                    <div style={{ fontSize: 11, color: "#64748B", marginBottom: 8 }}>{seg.time}</div>

                    {count === 0 ? (
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                          padding: "3px 8px",
                          borderRadius: 8,
                          background: "#DCFCE7",
                          color: "#166534",
                          fontSize: 11,
                          fontWeight: 800,
                        }}
                      >
                        Done ✓
                      </span>
                    ) : (
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          padding: "3px 8px",
                          borderRadius: 8,
                          background: "#FEF3C7",
                          color: "#B45309",
                          fontSize: 11,
                          fontWeight: 800,
                        }}
                      >
                        {count} {count === 1 ? "left" : "left"}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Snoozed Alert Banner ───────────────────────────────────────── */}
          {stats.snoozedCount > 0 && (
            <div
              style={{
                background: "#FEF3C7",
                border: "1.5px solid #FDE68A",
                borderRadius: 16,
                padding: "14px 18px",
                display: "flex",
                alignItems: "center",
                gap: 12,
                marginBottom: 24,
              }}
            >
              <span style={{ fontSize: 22 }}>⏰</span>
              <div style={{ flex: 1 }}>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: "#92400E" }}>
                  {stats.snoozedCount} {stats.snoozedCount === 1 ? "Medication" : "Medications"} Postponed
                </p>
                <p style={{ margin: "2px 0 0", fontSize: 13, color: "#B45309" }}>
                  Doses have been shifted to new time slots below. You can take them when ready or reset them.
                </p>
              </div>
            </div>
          )}

          {/* ── All Completed Celebration Card ────────────────────────────── */}
          {allCompleted && (
            <div
              style={{
                background: "#ECFDF5",
                border: "1.5px solid #A7F3D0",
                borderRadius: 20,
                padding: "24px",
                display: "flex",
                alignItems: "center",
                gap: 18,
                marginBottom: 24,
                boxShadow: "0 4px 12px rgba(16, 185, 129, 0.08)",
              }}
            >
              <div
                style={{
                  width: 54,
                  height: 54,
                  borderRadius: "50%",
                  background: "#00C896",
                  color: "#fff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 26,
                  flexShrink: 0,
                }}
              >
                🎉
              </div>
              <div style={{ flex: 1 }}>
                <h3 style={{ margin: "0 0 4px", fontSize: 18, fontWeight: 900, color: "#065F46" }}>
                  All Done For Today!
                </h3>
                <p style={{ margin: 0, fontSize: 14, color: "#047857" }}>
                  Great job staying on track with your health! All scheduled tablets have been successfully taken.
                </p>
              </div>
              <button
                onClick={handleResetDemo}
                style={{
                  padding: "8px 16px",
                  borderRadius: 10,
                  border: "1px solid #6EE7B7",
                  background: "#FFFFFF",
                  color: "#065F46",
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Reset for Demo
              </button>
            </div>
          )}

          {/* ── Empty State ────────────────────────────────────────────────── */}
          {groupedDoses.length === 0 && (
            <div
              style={{
                textAlign: "center",
                padding: "60px 24px",
                background: "#FFFFFF",
                borderRadius: 20,
                border: "1.5px dashed #CBD5E1",
              }}
            >
              <div style={{ fontSize: 40, marginBottom: 12 }}>💊</div>
              <p style={{ fontSize: 18, fontWeight: 800, color: "#0F172A", margin: "0 0 6px" }}>
                No doses found for this filter
              </p>
              <p style={{ fontSize: 14, color: "#64748B", margin: "0 0 16px" }}>
                {selectedPeriodFilter !== "all"
                  ? `No medications scheduled for the ${selectedPeriodFilter} slot.`
                  : "No scheduled medications recorded for today."}
              </p>
              <button
                onClick={() => {
                  setSelectedPeriodFilter("all");
                  setSelectedPatientId("all");
                }}
                style={{
                  padding: "8px 18px",
                  borderRadius: 10,
                  background: "#00C896",
                  color: "#fff",
                  fontWeight: 700,
                  fontSize: 13,
                  border: "none",
                  cursor: "pointer",
                }}
              >
                Show All Doses
              </button>
            </div>
          )}

          {/* ── Time-Grouped Doses Sections ────────────────────────────────── */}
          <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
            {groupedDoses.map(([timeSlot, slotDoses]) => {
              const slotTaken = slotDoses.filter((d) => d.status === "taken").length;
              const slotPending = slotDoses.filter(
                (d) => d.status === "pending" || d.status === "snoozed"
              ).length;
              const isSlotComplete = slotDoses.length > 0 && slotTaken === slotDoses.length;

              return (
                <section
                  key={timeSlot}
                  style={{
                    background: "#FFFFFF",
                    borderRadius: 24,
                    border: "1px solid #E2E8F0",
                    boxShadow: "0 4px 14px rgba(0,0,0,0.03)",
                    overflow: "hidden",
                  }}
                >
                  {/* Large Time Header */}
                  <div
                    style={{
                      padding: "18px 24px",
                      background: isSlotComplete ? "#F0FDF4" : "#F8FAFC",
                      borderBottom: "1px solid #E2E8F0",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <div
                        style={{
                          width: 38,
                          height: 38,
                          borderRadius: 12,
                          background: isSlotComplete ? "#DCFCE7" : "#FFFFFF",
                          border: isSlotComplete ? "1px solid #86EFAC" : "1.5px solid #CBD5E1",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 18,
                        }}
                      >
                        {isSlotComplete ? "✓" : "⏰"}
                      </div>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <h3
                            style={{
                              margin: 0,
                              fontSize: 22,
                              fontWeight: 900,
                              color: "#0F172A",
                              letterSpacing: "-0.03em",
                            }}
                          >
                            {timeSlot}
                          </h3>
                          <span
                            style={{
                              padding: "2px 8px",
                              borderRadius: 8,
                              background: isSlotComplete ? "#DCFCE7" : "#E2E8F0",
                              color: isSlotComplete ? "#15803D" : "#475569",
                              fontSize: 12,
                              fontWeight: 800,
                            }}
                          >
                            {slotDoses.length} {slotDoses.length === 1 ? "tablet" : "tablets to take"}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div>
                      {isSlotComplete ? (
                        <span
                          style={{
                            padding: "6px 14px",
                            borderRadius: 12,
                            background: "#DCFCE7",
                            color: "#15803D",
                            fontSize: 13,
                            fontWeight: 800,
                          }}
                        >
                          All Done ✓
                        </span>
                      ) : (
                        <span
                          style={{
                            padding: "6px 14px",
                            borderRadius: 12,
                            background: "#E0F2FE",
                            color: "#0369A1",
                            fontSize: 13,
                            fontWeight: 800,
                          }}
                        >
                          {slotPending} Pending
                        </span>
                      )}
                    </div>
                  </div>

                  {/* List of Medicine Cards in this slot */}
                  <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 16 }}>
                    {slotDoses.map((dose) => {
                      const isPending = dose.status === "pending" || dose.status === "snoozed";
                      const doseCallStatus = callStatusMap[dose.id] || "idle";

                      return (
                        <div
                          key={dose.id}
                          style={{
                            borderRadius: 18,
                            border: `1.5px solid ${isPending ? dose.color + "4D" : "#E2E8F0"}`,
                            background: isPending ? "#FFFFFF" : "#F8FAFC",
                            boxShadow: isPending ? `0 4px 16px ${dose.color}15` : "none",
                            overflow: "hidden",
                            display: "flex",
                            position: "relative",
                          }}
                        >
                          {/* Distinct thick left colored indicator */}
                          <div
                            style={{
                              width: 8,
                              background: dose.color,
                              flexShrink: 0,
                            }}
                          />

                          {/* Card Content */}
                          <div style={{ flex: 1, padding: "18px 22px" }}>
                            {/* Top info line */}
                            <div
                              style={{
                                display: "flex",
                                alignItems: "flex-start",
                                justifyContent: "space-between",
                                gap: 12,
                                marginBottom: 8,
                              }}
                            >
                              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                {/* Shape icon tag */}
                                <div
                                  style={{
                                    width: 38,
                                    height: 38,
                                    borderRadius: 12,
                                    background: `${dose.color}18`,
                                    border: `1.5px solid ${dose.color}40`,
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    fontSize: 18,
                                    flexShrink: 0,
                                  }}
                                  title={`Shape: ${dose.shape}`}
                                >
                                  {dose.shape === "round" ? "⚪" : dose.shape === "oval" ? "🥚" : "💊"}
                                </div>

                                <div>
                                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                                    <h4
                                      style={{
                                        margin: 0,
                                        fontSize: 19,
                                        fontWeight: 900,
                                        color: "#0F172A",
                                        letterSpacing: "-0.02em",
                                      }}
                                    >
                                      {dose.medicineName}
                                    </h4>
                                    <span
                                      style={{
                                        padding: "3px 9px",
                                        borderRadius: 8,
                                        background: `${dose.color}1A`,
                                        color: dose.color,
                                        fontSize: 13,
                                        fontWeight: 800,
                                      }}
                                    >
                                      {dose.dosage}
                                    </span>
                                    {dose.status === "pending" && (
                                      <span
                                        style={{
                                          fontSize: 13,
                                          fontWeight: 700,
                                          color: "#0284C7",
                                        }}
                                      >
                                        • Take this one
                                      </span>
                                    )}
                                    {doseCallStatus === "calling" && (
                                      <span
                                        style={{
                                          display: "inline-flex",
                                          alignItems: "center",
                                          gap: 4,
                                          padding: "3px 8px",
                                          borderRadius: 8,
                                          background: "#EFF6FF",
                                          color: "#1D4ED8",
                                          fontSize: 11,
                                          fontWeight: 800,
                                        }}
                                      >
                                        📞 Calling...
                                      </span>
                                    )}
                                    {doseCallStatus === "called" && (
                                      <span
                                        style={{
                                          display: "inline-flex",
                                          alignItems: "center",
                                          gap: 4,
                                          padding: "3px 8px",
                                          borderRadius: 8,
                                          background: "#DCFCE7",
                                          color: "#166534",
                                          fontSize: 11,
                                          fontWeight: 800,
                                        }}
                                      >
                                        📞 Called ✓
                                      </span>
                                    )}
                                    {doseCallStatus === "failed" && (
                                      <span
                                        style={{
                                          display: "inline-flex",
                                          alignItems: "center",
                                          gap: 4,
                                          padding: "3px 8px",
                                          borderRadius: 8,
                                          background: "#FEE2E2",
                                          color: "#DC2626",
                                          fontSize: 11,
                                          fontWeight: 800,
                                        }}
                                      >
                                        📞 Call Failed
                                      </span>
                                    )}
                                  </div>
                                  <p style={{ margin: "4px 0 0", fontSize: 13, color: "#64748B" }}>
                                    {dose.instructions}
                                  </p>
                                </div>
                              </div>

                              {/* Status Badge */}
                              <div>
                                {dose.status === "taken" && (
                                  <span
                                    style={{
                                      display: "inline-flex",
                                      alignItems: "center",
                                      gap: 4,
                                      padding: "4px 10px",
                                      borderRadius: 10,
                                      background: "#DCFCE7",
                                      color: "#166534",
                                      fontSize: 12,
                                      fontWeight: 800,
                                    }}
                                  >
                                    ✓ Taken
                                  </span>
                                )}
                                {dose.status === "snoozed" && (
                                  <span
                                    style={{
                                      display: "inline-flex",
                                      alignItems: "center",
                                      gap: 4,
                                      padding: "4px 10px",
                                      borderRadius: 10,
                                      background: "#FEF3C7",
                                      color: "#B45309",
                                      fontSize: 12,
                                      fontWeight: 800,
                                    }}
                                  >
                                    ⏰ Snoozed
                                  </span>
                                )}
                                {dose.status === "skipped" && (
                                  <span
                                    style={{
                                      padding: "4px 10px",
                                      borderRadius: 10,
                                      background: "#FFEDD5",
                                      color: "#C2410C",
                                      fontSize: 12,
                                      fontWeight: 800,
                                    }}
                                  >
                                    Skipped
                                  </span>
                                )}
                                {dose.status === "missed" && (
                                  <span
                                    style={{
                                      padding: "4px 10px",
                                      borderRadius: 10,
                                      background: "#FEE2E2",
                                      color: "#DC2626",
                                      fontSize: 12,
                                      fontWeight: 800,
                                    }}
                                  >
                                    Missed
                                  </span>
                                )}
                                {dose.status === "pending" && (
                                  <span
                                    style={{
                                      padding: "4px 10px",
                                      borderRadius: 10,
                                      background: "#E0F2FE",
                                      color: "#0369A1",
                                      fontSize: 12,
                                      fontWeight: 800,
                                    }}
                                  >
                                    Pending
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* ── Working Action Buttons or Resolved Banner ────── */}
                            <div style={{ marginTop: 16 }}>
                              {isPending ? (
                                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                                  {/* 1. Taken Button (Large Soft Green) */}
                                  <button
                                    onClick={() => handleMarkTaken(dose.id)}
                                    style={{
                                      flex: "2 1 180px",
                                      height: 48,
                                      borderRadius: 14,
                                      background: "#00C896",
                                      color: "#FFFFFF",
                                      border: "none",
                                      fontSize: 16,
                                      fontWeight: 800,
                                      cursor: "pointer",
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "center",
                                      gap: 8,
                                      boxShadow: "0 4px 12px rgba(0, 200, 150, 0.25)",
                                      transition: "transform 0.1s ease",
                                    }}
                                    onMouseDown={(e) => (e.currentTarget.style.transform = "scale(0.98)")}
                                    onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
                                  >
                                    <span style={{ fontSize: 18 }}>✓</span>
                                    <span>Taken</span>
                                  </button>

                                  {/* Call Now Button */}
                                  <button
                                    onClick={() => triggerCallForDose(dose, true)}
                                    disabled={doseCallStatus === "calling"}
                                    title="Call patient now to remind them to take this medication"
                                    style={{
                                      flex: "1 1 120px",
                                      height: 48,
                                      borderRadius: 14,
                                      background: doseCallStatus === "called" ? "#DCFCE7" : doseCallStatus === "calling" ? "#EFF6FF" : "#EFF6FF",
                                      color: doseCallStatus === "called" ? "#166534" : "#1D4ED8",
                                      border: `1.5px solid ${doseCallStatus === "called" ? "#86EFAC" : "#BFDBFE"}`,
                                      fontSize: 13,
                                      fontWeight: 800,
                                      cursor: doseCallStatus === "calling" ? "not-allowed" : "pointer",
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "center",
                                      gap: 6,
                                      opacity: doseCallStatus === "calling" ? 0.7 : 1,
                                    }}
                                  >
                                    <span>{doseCallStatus === "calling" ? "📞" : doseCallStatus === "called" ? "✓" : "📞"}</span>
                                    <span>{doseCallStatus === "calling" ? "Calling..." : doseCallStatus === "called" ? "Called" : "Call Now"}</span>
                                  </button>

                                  {/* 2. Snooze Button (Amber) */}
                                  <button
                                    onClick={() => setActiveSnoozeModalDose(dose)}
                                    style={{
                                      flex: "1 1 120px",
                                      height: 48,
                                      borderRadius: 14,
                                      background: "#FEF3C7",
                                      color: "#B45309",
                                      border: "1.5px solid #FDE68A",
                                      fontSize: 14,
                                      fontWeight: 800,
                                      cursor: "pointer",
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "center",
                                      gap: 6,
                                    }}
                                  >
                                    <span>⏰</span>
                                    <span>Snooze</span>
                                  </button>

                                  {/* 3. Skip Button (Orange) */}
                                  <button
                                    onClick={() => handleMarkSkip(dose.id)}
                                    style={{
                                      flex: "1 1 100px",
                                      height: 48,
                                      borderRadius: 14,
                                      background: "#FFEDD5",
                                      color: "#C2410C",
                                      border: "1.5px solid #FED7AA",
                                      fontSize: 14,
                                      fontWeight: 700,
                                      cursor: "pointer",
                                    }}
                                  >
                                    Skip
                                  </button>

                                  {/* 4. Missed Button (Red) */}
                                  <button
                                    onClick={() => handleMarkMissed(dose.id)}
                                    style={{
                                      flex: "1 1 100px",
                                      height: 48,
                                      borderRadius: 14,
                                      background: "#FEE2E2",
                                      color: "#B91C1C",
                                      border: "1.5px solid #FECACA",
                                      fontSize: 14,
                                      fontWeight: 700,
                                      cursor: "pointer",
                                    }}
                                  >
                                    Missed
                                  </button>
                                </div>
                              ) : (
                                /* Resolved Banner */
                                <div
                                  style={{
                                    padding: "12px 16px",
                                    borderRadius: 12,
                                    background:
                                      dose.status === "taken"
                                        ? "#ECFDF5"
                                        : dose.status === "skipped"
                                        ? "#FFF7ED"
                                        : "#FEF2F2",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "space-between",
                                  }}
                                >
                                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                    <span style={{ fontSize: 16 }}>
                                      {dose.status === "taken" ? "✅" : dose.status === "skipped" ? "⏭️" : "❌"}
                                    </span>
                                    <span
                                      style={{
                                        fontSize: 14,
                                        fontWeight: 800,
                                        color:
                                          dose.status === "taken"
                                            ? "#065F46"
                                            : dose.status === "skipped"
                                            ? "#9A3412"
                                            : "#991B1B",
                                      }}
                                    >
                                      {dose.status === "taken"
                                        ? `Taken at ${
                                            dose.actualTakenTime
                                              ? new Date(dose.actualTakenTime).toLocaleTimeString([], {
                                                  hour: "2-digit",
                                                  minute: "2-digit",
                                                })
                                              : timeSlot
                                          }`
                                        : dose.status === "skipped"
                                        ? "Skipped this scheduled dose"
                                        : "Marked as Missed"}
                                    </span>
                                  </div>
                                  <button
                                    onClick={() => handleUndo(dose.id)}
                                    style={{
                                      background: "none",
                                      border: "none",
                                      color: "#475569",
                                      textDecoration: "underline",
                                      fontSize: 13,
                                      fontWeight: 700,
                                      cursor: "pointer",
                                    }}
                                  >
                                    Undo
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        </div>
      </main>

      {/* ── Snooze Picker Modal ────────────────────────────────────────────── */}
      {activeSnoozeModalDose && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.55)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 999,
            padding: 16,
          }}
          onClick={() => setActiveSnoozeModalDose(null)}
        >
          <div
            style={{
              background: "#FFFFFF",
              borderRadius: 24,
              padding: "28px 24px",
              maxWidth: 440,
              width: "100%",
              boxShadow: "0 20px 40px rgba(0,0,0,0.2)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 14,
                  background: "#FEF3C7",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 22,
                }}
              >
                ⏰
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 900, color: "#0F172A" }}>
                  Snooze Reminder
                </h3>
                <p style={{ margin: "2px 0 0", fontSize: 13, color: "#64748B" }}>
                  {activeSnoozeModalDose.medicineName} ({activeSnoozeModalDose.dosage})
                </p>
              </div>
            </div>

            <p style={{ fontSize: 14, color: "#475569", margin: "0 0 18px", lineHeight: 1.5 }}>
              Choose how long you want to delay this tablet. The schedule will move and notify you under the new time slot:
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
              <button
                onClick={() => handleSnooze(activeSnoozeModalDose.id, 15)}
                style={{
                  padding: "14px 18px",
                  borderRadius: 14,
                  border: "1.5px solid #E2E8F0",
                  background: "#F8FAFC",
                  textAlign: "left",
                  fontSize: 15,
                  fontWeight: 800,
                  color: "#0F172A",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <span>⏱️ 15 Minutes</span>
                <span style={{ fontSize: 12, color: "#64748B", fontWeight: 600 }}>Quick delay</span>
              </button>

              <button
                onClick={() => handleSnooze(activeSnoozeModalDose.id, 30)}
                style={{
                  padding: "14px 18px",
                  borderRadius: 14,
                  border: "2px solid #F59E0B",
                  background: "#FFFBEB",
                  textAlign: "left",
                  fontSize: 15,
                  fontWeight: 800,
                  color: "#92400E",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <span>⏳ 30 Minutes</span>
                <span
                  style={{
                    fontSize: 10,
                    color: "#FFFFFF",
                    background: "#D97706",
                    padding: "2px 8px",
                    borderRadius: 10,
                    fontWeight: 800,
                  }}
                >
                  RECOMMENDED
                </span>
              </button>

              <button
                onClick={() => handleSnooze(activeSnoozeModalDose.id, 60)}
                style={{
                  padding: "14px 18px",
                  borderRadius: 14,
                  border: "1.5px solid #E2E8F0",
                  background: "#F8FAFC",
                  textAlign: "left",
                  fontSize: 15,
                  fontWeight: 800,
                  color: "#0F172A",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <span>⌛ 1 Hour</span>
                <span style={{ fontSize: 12, color: "#64748B", fontWeight: 600 }}>After rest</span>
              </button>
            </div>

            <button
              onClick={() => setActiveSnoozeModalDose(null)}
              style={{
                width: "100%",
                padding: "12px",
                borderRadius: 12,
                border: "none",
                background: "#F1F5F9",
                color: "#475569",
                fontSize: 14,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ── Toast Notification ─────────────────────────────────────────────── */}
      {toastMessage && (
        <div
          style={{
            position: "fixed",
            bottom: 24,
            right: 24,
            background: "#0F172A",
            color: "#FFFFFF",
            padding: "12px 20px",
            borderRadius: 14,
            fontSize: 14,
            fontWeight: 700,
            boxShadow: "0 10px 25px rgba(0,0,0,0.2)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
