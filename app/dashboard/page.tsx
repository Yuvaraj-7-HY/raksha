"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type ServerState = {
  status: "idle" | "ringing" | "in_call";
  callId?: string;
  callType?: string;
  context?: string;
  attempt?: number;
  patientName: string;
  ringAgeSeconds?: number;
};

export default function DashboardPage() {
  const [state, setState] = useState<ServerState | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [callType, setCallType] = useState("morning");
  const [realtimeConnected, setRealtimeConnected] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/state", { cache: "no-store" });
      setState((await res.json()) as ServerState);
    } catch {
      // ignore
    }
  }, []);

  // ── Supabase Realtime subscription ────────────────────────────────────────
  useEffect(() => {
    const channel = supabase.channel("ring-state", {
      config: { broadcast: { self: false } },
    });

    channel
      .on("broadcast", { event: "state-update" }, ({ payload }) => {
        setState(payload as ServerState);
      })
      .subscribe((status) => {
        setRealtimeConnected(status === "SUBSCRIBED");
        if (status === "SUBSCRIBED") {
          // Fetch current state once on connect to sync immediately.
          void refresh();
        }
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [refresh]);

  // ── Fallback polling (slower when realtime is up) ─────────────────────────
  useEffect(() => {
    // Always do an initial fetch.
    void refresh();
    // Poll every 10 s as a safety net (realtime handles the fast path).
    const id = window.setInterval(() => void refresh(), 10_000);
    return () => window.clearInterval(id);
  }, [refresh]);

  const reset = useCallback(async () => {
    setBusy(true);
    setMessage(null);
    try {
      await fetch("/api/dev/reset", { method: "POST" });
      await refresh();
      setMessage("State reset to idle.");
    } catch {
      setMessage("Reset failed.");
    } finally {
      setBusy(false);
    }
  }, [refresh]);

  const ring = useCallback(async () => {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/dev/ring", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          callType,
          context:
            callType === "evening"
              ? "Evening medication check. Ask how she is feeling and whether she took her evening medicines."
              : "Morning medication check. Ask how she is feeling and whether she took her morning medicines.",
          attempt: 0,
        }),
      });
      const data = await res.json();
      if (res.status === 409) {
        setMessage("Phone is busy — finish or decline the current call first.");
      } else if (!res.ok) {
        setMessage(data?.error ?? "Failed to ring.");
      } else {
        setMessage("Ringing… check the phone tab.");
        await refresh();
      }
    } catch {
      setMessage("Network error.");
    } finally {
      setBusy(false);
    }
  }, [callType, refresh]);

  // ── Real Twilio outbound call ─────────────────────────────────────────────
  const callGrandma = useCallback(async () => {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: process.env.NEXT_PUBLIC_PATIENT_PHONE ?? "+917406842246" }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data?.error ?? "Call failed.");
      } else {
        setMessage(`📞 Calling +917406842246… SID: ${data.sid}`);
      }
    } catch {
      setMessage("Network error — is the server running?");
    } finally {
      setBusy(false);
    }
  }, []);

  const statusColor =
    state?.status === "ringing"
      ? { dot: "#E31837", badge: "badge-red", label: "Ringing" }
      : state?.status === "in_call"
        ? { dot: "#16A36A", badge: "badge-green", label: "In Call" }
        : { dot: "#D97706", badge: "badge-amber", label: state?.status === undefined ? "Loading…" : "Idle" };

  // Keep legacy compat
  const statusTone =
    state?.status === "ringing"
      ? "text-decline"
      : state?.status === "in_call"
        ? "text-accept"
        : "text-amber";

  return (
    <div className="flex min-h-dvh" style={{ background: "var(--bg)", fontFamily: "var(--font-sans)" }}>

      {/* ── Fixed Sidebar ────────────────────────────────────────────────────── */}
      <aside style={{
        width: 240,
        minWidth: 240,
        background: "var(--surface)",
        borderRight: "1px solid var(--border)",
        display: "flex",
        flexDirection: "column",
        position: "fixed",
        top: 0,
        left: 0,
        bottom: 0,
        zIndex: 40,
        padding: "0 12px",
        boxShadow: "var(--shadow-sm)"
      }}>
        {/* Brand */}
        <div style={{ padding: "24px 8px 20px", borderBottom: "1px solid var(--border)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 34, height: 34, borderRadius: 9,
              background: "var(--primary)",
              display: "flex", alignItems: "center", justifyContent: "center"
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                <polyline points="9 22 9 12 15 12 15 22"/>
              </svg>
            </div>
            <div>
              <p style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", margin: 0, letterSpacing: "-0.01em" }}>Raksha</p>
              <p style={{ fontSize: 11, color: "var(--text-secondary)", margin: 0 }}>Care Platform</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, paddingTop: 16, display: "flex", flexDirection: "column", gap: 2 }}>
          <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", color: "var(--text-muted)", textTransform: "uppercase", padding: "0 14px 8px", marginTop: 4 }}>Overview</p>
          <a href="/dashboard" className="sidebar-item active">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
            Dashboard
          </a>
          <a href="/phone" className="sidebar-item">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.18 2 2 0 0 1 3.6 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.62a16 16 0 0 0 6 6l.92-.92a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
            Phone
          </a>
          <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", color: "var(--text-muted)", textTransform: "uppercase", padding: "12px 14px 8px" }}>Care</p>
          <a href="/patients" className="sidebar-item">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            Patients
          </a>
          <a href="/patients?tab=vitals" className="sidebar-item">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
            Vitals
          </a>
          <a href="/patients?tab=medications" className="sidebar-item">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            Medications
          </a>

        </nav>

        {/* Realtime indicator */}
        <div style={{ padding: "14px 8px 20px", borderTop: "1px solid var(--border)" }}>
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "8px 12px", borderRadius: 8,
            background: realtimeConnected ? "var(--green-soft)" : "var(--surface-2)",
          }}>
            <span style={{
              width: 7, height: 7, borderRadius: "50%",
              background: realtimeConnected ? "var(--green)" : "var(--text-muted)",
              flexShrink: 0,
              ...(realtimeConnected ? { animation: "pulse-ring 1.8s ease-out infinite" } : {}),
            }} />
            <div>
              <p style={{ margin: 0, fontSize: 11, fontWeight: 600, color: realtimeConnected ? "var(--green)" : "var(--text-secondary)" }}>
                {realtimeConnected ? "Live Sync" : "Polling"}
              </p>
              <p style={{ margin: 0, fontSize: 10, color: "var(--text-muted)" }}>
                {realtimeConnected ? "Real-time updates" : "10s refresh"}
              </p>
            </div>
          </div>
        </div>
      </aside>

      {/* ── Main Content (offset for sidebar) ──────────────────────────────── */}
      <div style={{ flex: 1, marginLeft: 240, minHeight: "100dvh", display: "flex", flexDirection: "column" }}>

        {/* ── Top Header ─────────────────────────────────────────────────── */}
        <header style={{
          height: 64,
          background: "var(--surface)",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 28px",
          position: "sticky",
          top: 0,
          zIndex: 30,
          boxShadow: "var(--shadow-sm)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div>
              <p style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>Care Dashboard</p>
              <p style={{ margin: 0, fontSize: 12, color: "var(--text-secondary)" }}>Patient monitoring & call management</p>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {/* Patient pill */}
            <div style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "6px 14px 6px 8px",
              borderRadius: 999,
              background: "var(--navy)",
              color: "#fff",
            }}>
              <div style={{ width: 26, height: 26, borderRadius: "50%", background: "rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700 }}>
                {(state?.patientName ?? "G").charAt(0).toUpperCase()}
              </div>
              <span style={{ fontSize: 13, fontWeight: 600 }}>{state?.patientName ?? "Grandma"}</span>
            </div>
            {/* Notifications */}
            <button type="button" style={{
              width: 36, height: 36, borderRadius: 10, border: "1px solid var(--border)",
              background: "var(--surface)", display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", position: "relative"
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
              {state?.status === "ringing" && (
                <span style={{ position: "absolute", top: 6, right: 6, width: 7, height: 7, borderRadius: "50%", background: "var(--primary)", border: "1.5px solid var(--surface)" }} />
              )}
            </button>
            {/* SOS Emergency */}
            <button
              type="button"
              id="call-grandma-btn"
              onClick={() => void callGrandma()}
              disabled={busy}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "7px 14px", borderRadius: 9,
                background: "var(--primary)", color: "#fff",
                border: "none", fontSize: 13, fontWeight: 700,
                cursor: busy ? "not-allowed" : "pointer",
                opacity: busy ? 0.6 : 1,
                letterSpacing: "0.01em",
                transition: "opacity 0.15s",
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.18 2 2 0 0 1 3.6 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.62a16 16 0 0 0 6 6l.92-.92a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
              {busy ? "Calling…" : "Emergency Call"}
            </button>
          </div>
        </header>

        {/* ── Status Bar ─────────────────────────────────────────────────── */}
        <div style={{
          background: "var(--navy)",
          padding: "10px 28px",
          display: "flex",
          alignItems: "center",
          gap: 20,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, color: "rgba(255,255,255,0.9)" }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: state?.status === "in_call" ? "#4ade80" : state?.status === "ringing" ? "#f87171" : "#fbbf24", flexShrink: 0, display: "block" }} />
            <span style={{ fontSize: 12, fontWeight: 600 }}>
              Telephony: <span style={{ textTransform: "capitalize" }}>{state?.status ?? "Loading…"}</span>
            </span>
          </div>
          <div style={{ width: 1, height: 14, background: "rgba(255,255,255,0.2)" }} />
          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.65)" }}>
            {state?.callType ? `Call type: ${state.callType}` : "No active call"}
          </span>
          {state?.callId && (
            <>
              <div style={{ width: 1, height: 14, background: "rgba(255,255,255,0.2)" }} />
              <span style={{ fontSize: 11, fontFamily: "monospace", color: "rgba(255,255,255,0.45)", maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {state.callId}
              </span>
            </>
          )}
          <div style={{ marginLeft: "auto" }}>
            <a href="/phone" style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "5px 12px", borderRadius: 8,
              background: "rgba(255,255,255,0.12)", color: "#fff",
              textDecoration: "none", fontSize: 12, fontWeight: 500,
              border: "1px solid rgba(255,255,255,0.15)",
              transition: "background 0.15s",
            }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.18 2 2 0 0 1 3.6 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.62a16 16 0 0 0 6 6l.92-.92a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
              Open Phone
            </a>
          </div>
        </div>

        {/* ── Page Content ───────────────────────────────────────────────── */}
        <main style={{ flex: 1, padding: "28px 28px 40px" }}>

          {/* Greeting */}
          <div style={{ marginBottom: 24 }}>
            <h1 style={{ margin: "0 0 4px", fontSize: 22, fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
              Good {new Date().getHours() < 12 ? "morning" : new Date().getHours() < 17 ? "afternoon" : "evening"} 👋
            </h1>
            <p style={{ margin: 0, fontSize: 14, color: "var(--text-secondary)" }}>
              Here&apos;s an overview of {state?.patientName ?? "your patient"}&apos;s care status today.
            </p>
          </div>

          {/* ── KPI Cards ──────────────────────────────────────────────── */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
            {/* Card: Phone Status */}
            <div className="hc-card fade-in" style={{ padding: 20 }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: "var(--primary-soft)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.18 2 2 0 0 1 3.6 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.62a16 16 0 0 0 6 6l.92-.92a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                </div>
                <span className={statusColor.badge}>{statusColor.label}</span>
              </div>
              <p style={{ margin: "0 0 2px", fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-muted)" }}>Phone Status</p>
              <p style={{ margin: 0, fontSize: 26, fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.03em", textTransform: "capitalize" }}>
                {state?.status ?? "—"}
              </p>
            </div>

            {/* Card: Call Type */}
            <div className="hc-card fade-in" style={{ padding: 20, animationDelay: "0.06s" }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: "var(--navy-soft)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--navy)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
              </div>
              <p style={{ margin: "0 0 2px", fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-muted)" }}>Call Type</p>
              <p style={{ margin: 0, fontSize: 26, fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.03em", textTransform: "capitalize" }}>
                {state?.callType ?? "—"}
              </p>
              <p style={{ margin: "4px 0 0", fontSize: 11, color: "var(--text-muted)" }}>
                {state?.attempt !== undefined ? `Attempt #${state.attempt + 1}` : "No active call"}
              </p>
            </div>

            {/* Card: Patient */}
            <div className="hc-card fade-in" style={{ padding: 20, animationDelay: "0.12s" }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: "var(--green-soft)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              </div>
              <p style={{ margin: "0 0 2px", fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-muted)" }}>Patient</p>
              <p style={{ margin: 0, fontSize: 26, fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.03em" }}>
                {state?.patientName ?? "—"}
              </p>
              <p style={{ margin: "4px 0 0", fontSize: 11, color: "var(--text-muted)" }}>Active care plan</p>
            </div>

            {/* Card: Sync */}
            <div className="hc-card fade-in" style={{ padding: 20, animationDelay: "0.18s" }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: realtimeConnected ? "var(--green-soft)" : "var(--amber-soft)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={realtimeConnected ? "var(--green)" : "var(--amber)"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10"/><polyline points="23 20 23 14 17 14"/><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4-4.64 4.36A9 9 0 0 1 3.51 15"/></svg>
              </div>
              <p style={{ margin: "0 0 2px", fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-muted)" }}>Data Sync</p>
              <p style={{ margin: 0, fontSize: 26, fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.03em" }}>
                {realtimeConnected ? "Live" : "Polling"}
              </p>
              <p style={{ margin: "4px 0 0", fontSize: 11, color: "var(--text-muted)" }}>
                {realtimeConnected ? "Real-time updates active" : "10 second intervals"}
              </p>
            </div>
          </div>

          {/* ── Two-column layout ───────────────────────────────────────── */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>

            {/* Left: Phone Status Panel */}
            <div className="hc-card" style={{ padding: 24 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: statusColor.dot, flexShrink: 0 }} />
                  <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>Telephony Status</h2>
                </div>
                <span className={statusColor.badge}>{statusColor.label}</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", borderRadius: 10, background: "var(--surface-2)", border: "1px solid var(--border)" }}>
                  <span style={{ fontSize: 12, color: "var(--text-secondary)", fontWeight: 500 }}>Status</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", textTransform: "capitalize" }}>{state?.status ?? "Loading…"}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", borderRadius: 10, background: "var(--surface-2)", border: "1px solid var(--border)" }}>
                  <span style={{ fontSize: 12, color: "var(--text-secondary)", fontWeight: 500 }}>Call Type</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", textTransform: "capitalize" }}>{state?.callType ?? "—"}</span>
                </div>
                {state?.attempt !== undefined && (
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", borderRadius: 10, background: "var(--surface-2)", border: "1px solid var(--border)" }}>
                    <span style={{ fontSize: 12, color: "var(--text-secondary)", fontWeight: 500 }}>Attempt</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>#{state.attempt + 1}</span>
                  </div>
                )}
              </div>
              {state?.context && (
                <div style={{ marginTop: 16, padding: "12px 14px", borderRadius: 10, background: "var(--amber-soft)", border: "1px solid rgba(217,119,6,0.15)" }}>
                  <p style={{ margin: "0 0 4px", fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--amber)" }}>Active Context</p>
                  <p style={{ margin: 0, fontSize: 12, color: "var(--text-primary)", lineHeight: 1.6 }}>{state.context}</p>
                </div>
              )}
            </div>

            {/* Right: Trigger Panel */}
            <div className="hc-card" style={{ padding: 24 }}>
              <h2 style={{ margin: "0 0 4px", fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>Trigger a Call</h2>
              <p style={{ margin: "0 0 18px", fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.5 }}>
                Hits <code style={{ background: "var(--surface-2)", padding: "1px 6px", borderRadius: 4, fontFamily: "monospace", fontSize: 11, color: "var(--navy)" }}>POST /api/dev/ring</code>. Later n8n uses <code style={{ background: "var(--surface-2)", padding: "1px 6px", borderRadius: 4, fontFamily: "monospace", fontSize: 11, color: "var(--navy)" }}>/api/ring</code> + secret.
              </p>

              {/* Call type selector */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 18 }}>
                {["morning", "evening", "followup", "retry"].map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setCallType(t)}
                    style={{
                      padding: "6px 14px",
                      borderRadius: 8,
                      border: callType === t ? "none" : "1px solid var(--border)",
                      background: callType === t ? "var(--navy)" : "var(--surface)",
                      color: callType === t ? "#fff" : "var(--text-secondary)",
                      fontSize: 13,
                      fontWeight: 500,
                      cursor: "pointer",
                      textTransform: "capitalize",
                      transition: "all 0.15s",
                    }}
                  >
                    {t}
                  </button>
                ))}
              </div>

              {/* Action buttons */}
              <div style={{ display: "flex", gap: 10 }}>
                <button
                  type="button"
                  onClick={() => void ring()}
                  disabled={busy || state?.status === "ringing" || state?.status === "in_call"}
                  style={{
                    flex: 1,
                    padding: "12px 20px",
                    borderRadius: 10,
                    border: "none",
                    background: "var(--primary)",
                    color: "#fff",
                    fontSize: 14,
                    fontWeight: 700,
                    cursor: (busy || state?.status === "ringing" || state?.status === "in_call") ? "not-allowed" : "pointer",
                    opacity: (busy || state?.status === "ringing" || state?.status === "in_call") ? 0.5 : 1,
                    transition: "all 0.15s",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                  }}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.18 2 2 0 0 1 3.6 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.62a16 16 0 0 0 6 6l.92-.92a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                  {state?.status === "idle" || !state ? "Ring Phone" : "Phone Busy"}
                </button>
                <button
                  type="button"
                  onClick={() => void reset()}
                  disabled={busy}
                  title="Force reset state to idle"
                  style={{
                    padding: "12px 16px",
                    borderRadius: 10,
                    border: "1px solid var(--border)",
                    background: "var(--surface)",
                    color: "var(--text-secondary)",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: busy ? "not-allowed" : "pointer",
                    opacity: busy ? 0.5 : 1,
                    transition: "all 0.15s",
                  }}
                >
                  Reset
                </button>
              </div>

              {message && (
                <div style={{
                  marginTop: 14,
                  padding: "10px 14px",
                  borderRadius: 8,
                  background: message.startsWith("📞") ? "var(--green-soft)" : message.toLowerCase().includes("fail") || message.toLowerCase().includes("error") || message.toLowerCase().includes("busy") ? "var(--red-soft)" : "var(--amber-soft)",
                  border: `1px solid ${message.startsWith("📞") ? "rgba(22,163,106,0.2)" : message.toLowerCase().includes("fail") || message.toLowerCase().includes("error") || message.toLowerCase().includes("busy") ? "rgba(227,24,55,0.15)" : "rgba(217,119,6,0.15)"}`,
                  fontSize: 12,
                  color: message.startsWith("📞") ? "var(--green)" : message.toLowerCase().includes("fail") || message.toLowerCase().includes("error") || message.toLowerCase().includes("busy") ? "var(--red)" : "var(--amber)",
                  fontWeight: 500,
                }}>
                  {message}
                </div>
              )}
            </div>
          </div>

          {/* ── Medication Management Card ─────────────────────────────────────── */}
          <div className="hc-card" style={{ padding: 24, marginBottom: 20 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: "var(--navy-soft)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--navy)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                </div>
                <div>
                  <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>Medication Management</h2>
                  <p style={{ margin: 0, fontSize: 11, color: "var(--text-secondary)" }}>Add and track {state?.patientName ?? "patient"}&apos;s medicines</p>
                </div>
              </div>
              <a href="/patients?tab=medications" style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: "6px 14px", borderRadius: 8,
                border: "1px solid var(--border)", background: "var(--surface-2)",
                color: "var(--text-secondary)", textDecoration: "none", fontSize: 12, fontWeight: 500,
              }}>View All Meds</a>
            </div>

            {/* Primary CTA */}
            <a
              href="/patients/add-medication"
              style={{
                display: "flex", alignItems: "center", gap: 16,
                padding: "18px 20px", borderRadius: 14,
                background: "linear-gradient(135deg, #0D9488 0%, #0a7a70 100%)",
                color: "#fff", textDecoration: "none", marginBottom: 12,
                boxShadow: "0 6px 20px rgba(13,148,136,0.28)",
              }}
            >
              <div style={{ width: 48, height: 48, borderRadius: 12, background: "rgba(255,255,255,0.18)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                </svg>
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ margin: "0 0 2px", fontSize: 15, fontWeight: 700 }}>Add Medication</p>
                <p style={{ margin: 0, fontSize: 12, opacity: 0.82 }}>Scan barcode, prescription, or enter manually</p>
              </div>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
            </a>

            {/* Quick action row */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
              <a href="/patients" style={{
                display: "flex", alignItems: "center", gap: 12, padding: "12px 14px",
                borderRadius: 12, border: "1.5px solid var(--border)", background: "var(--surface-2)",
                color: "var(--text-primary)", textDecoration: "none",
              }}>
                <div style={{ width: 34, height: 34, borderRadius: 9, background: "#CCFBF1", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#0D9488" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
                </div>
                <div>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 700 }}>Patients</p>
                  <p style={{ margin: 0, fontSize: 11, color: "var(--text-secondary)" }}>Manage patient list</p>
                </div>
              </a>
              <a href="/patients?tab=vitals" style={{
                display: "flex", alignItems: "center", gap: 12, padding: "12px 14px",
                borderRadius: 12, border: "1.5px solid var(--border)", background: "var(--surface-2)",
                color: "var(--text-primary)", textDecoration: "none",
              }}>
                <div style={{ width: 34, height: 34, borderRadius: 9, background: "#FEF2F2", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
                </div>
                <div>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 700 }}>Vitals Log</p>
                  <p style={{ margin: 0, fontSize: 11, color: "var(--text-secondary)" }}>Sugar & BP tracking</p>
                </div>
              </a>
              <a href="/patients?tab=medications" style={{
                display: "flex", alignItems: "center", gap: 12, padding: "12px 14px",
                borderRadius: 12, border: "1.5px solid var(--border)", background: "var(--surface-2)",
                color: "var(--text-primary)", textDecoration: "none",
              }}>
                <div style={{ width: 34, height: 34, borderRadius: 9, background: "#EFF6FF", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                </div>
                <div>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 700 }}>Medications</p>
                  <p style={{ margin: 0, fontSize: 11, color: "var(--text-secondary)" }}>All prescriptions</p>
                </div>
              </a>
            </div>
          </div>

          {/* ── Demo Checklist ──────────────────────────────────────────── */}
          <div className="hc-card" style={{ padding: 24 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
              <div style={{ width: 32, height: 32, borderRadius: 9, background: "var(--navy-soft)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--navy)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>Demo Checklist</h3>
                <p style={{ margin: 0, fontSize: 11, color: "var(--text-secondary)" }}>Follow these steps to test the system</p>
              </div>
            </div>
            <ol style={{ margin: 0, padding: "0 0 0 0", listStyle: "none", display: "flex", flexDirection: "column", gap: 10 }}>
              {[
                "Keep /phone open on the Android tab (foreground, screen on).",
                "Press Start phone on the phone once.",
                "Press Ring phone here — the phone should ring within ~2s.",
                "Accept → in-call timer. Hang up or let it miss → idle again.",
              ].map((item, i) => (
                <li key={i} style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "10px 14px", borderRadius: 10, background: "var(--surface-2)", border: "1px solid var(--border)" }}>
                  <span style={{ width: 22, height: 22, borderRadius: "50%", background: "var(--navy)", color: "#fff", fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>
                    {i + 1}
                  </span>
                  <span style={{ fontSize: 13, color: "var(--text-primary)", lineHeight: 1.5 }}>{item}</span>
                </li>
              ))}
            </ol>
          </div>
        </main>
      </div>
    </div>
  );
}
