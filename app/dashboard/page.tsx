"use client";

import { useCallback, useEffect, useState } from "react";

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

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/state", { cache: "no-store" });
      setState((await res.json()) as ServerState);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => void refresh(), 2000);
    const first = window.setTimeout(() => void refresh(), 0);
    return () => {
      window.clearInterval(id);
      window.clearTimeout(first);
    };
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

  const statusTone =
    state?.status === "ringing"
      ? "text-decline"
      : state?.status === "in_call"
        ? "text-accept"
        : "text-amber";

  return (
    <div className="noise relative min-h-dvh">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/4 top-0 h-[40vh] w-[40vh] rounded-full bg-amber/10 blur-3xl" />
      </div>

      <div className="relative z-10 mx-auto w-full max-w-2xl px-6 py-10">
        <header className="mb-10 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.28em] text-amber">
              Raksha control
            </p>
            <h1 className="mt-2 font-display text-4xl">Care dashboard</h1>
            <p className="mt-2 text-sm text-muted">
              Dev harness · trigger the phone, watch live state
            </p>
          </div>
          <a
            href="/phone"
            className="rounded-full border border-line bg-panel px-4 py-2 text-sm text-ink transition hover:border-amber/50 hover:text-ambersoft"
          >
            Open phone →
          </a>
        </header>

        <section className="mb-6 rounded-3xl border border-line bg-panel/80 p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-[11px] uppercase tracking-[0.2em] text-muted">
                Phone status
              </p>
              <p className={`mt-2 text-2xl font-semibold capitalize ${statusTone}`}>
                {state?.status ?? "…"}
              </p>
            </div>
            <div className="text-right text-sm text-muted">
              <p>{state?.patientName ?? "Grandma"}</p>
              <p className="mt-1">
                {state?.callType ? `Type: ${state.callType}` : "No active call"}
              </p>
              {state?.callId && (
                <p className="mt-1 max-w-[14rem] truncate font-mono text-[10px]">
                  {state.callId}
                </p>
              )}
            </div>
          </div>

          {state?.context && (
            <p className="mt-4 rounded-2xl border border-line bg-bg/60 p-4 text-sm leading-relaxed text-muted">
              <span className="mb-1 block text-[10px] uppercase tracking-[0.2em] text-amber">
                Active context
              </span>
              {state.context}
            </p>
          )}
        </section>

        <section className="rounded-3xl border border-line bg-panel/80 p-6">
          <h2 className="text-lg font-semibold">Trigger a call</h2>
          <p className="mt-1 text-sm text-muted">
            Hits <code className="text-ambersoft">POST /api/dev/ring</code>.
            Later n8n uses <code className="text-ambersoft">/api/ring</code> +
            secret instead.
          </p>

          <div className="mt-5 flex flex-wrap gap-2">
            {["morning", "evening", "followup", "retry"].map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setCallType(t)}
                className={`rounded-full px-4 py-2 text-sm capitalize transition ${
                  callType === t
                    ? "bg-amber text-stone-950"
                    : "border border-line bg-bg/40 text-muted hover:text-ink"
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          <div className="mt-5 flex gap-3">
            <button
              type="button"
              onClick={() => void ring()}
              disabled={busy || state?.status === "ringing" || state?.status === "in_call"}
              className="flex-1 rounded-2xl bg-amber px-6 py-4 text-base font-semibold text-stone-950 transition hover:brightness-110 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {state?.status === "idle" || !state ? "Ring phone" : "Phone busy"}
            </button>
            <button
              type="button"
              onClick={() => void reset()}
              disabled={busy}
              title="Force reset state to idle"
              className="rounded-2xl border border-line bg-bg/40 px-5 py-4 text-sm text-muted transition hover:border-red-500/50 hover:text-red-400 disabled:opacity-40"
            >
              Reset
            </button>
          </div>

          {message && (
            <p className="mt-3 text-sm text-ambersoft">{message}</p>
          )}
        </section>

        <section className="mt-6 rounded-3xl border border-dashed border-line p-6 text-sm text-muted">
          <p className="mb-2 text-[11px] uppercase tracking-[0.2em] text-amber">
            Demo checklist
          </p>
          <ol className="list-decimal space-y-1 pl-5">
            <li>Keep /phone open on the Android tab (foreground, screen on).</li>
            <li>Press Start phone on the phone once.</li>
            <li>Press Ring phone here — the phone should ring within ~2s.</li>
            <li>Accept → in-call timer. Hang up or let it miss → idle again.</li>
          </ol>
        </section>
      </div>
    </div>
  );
}
