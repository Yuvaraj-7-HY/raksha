"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CARE_CONFIG } from "@/lib/careConfig";
import { browserTransport } from "@/lib/transport/browserTransport";
import { warmVoices } from "@/lib/speech/synthesizer";
import type { TranscriptEntry, TurnResponse } from "@/lib/transport/types";

type Phase = "BOOT" | "IDLE" | "RINGING" | "IN_CALL" | "ENDED";

type ServerState = {
  status: "idle" | "ringing" | "in_call";
  callId?: string;
  callType?: string;
  context?: string;
  attempt?: number;
  patientName: string;
  ringAgeSeconds?: number;
};

type EndedReason = "completed" | "missed" | "declined" | null;

type VoiceStatus = "idle" | "thinking" | "speaking" | "listening" | "ended";

const RING_TIMEOUT_SECONDS = 30;
const MAX_CALL_TURNS = CARE_CONFIG.maxCallTurns;

function formatTimer(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const s = (totalSeconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

function ringtoneStart(): (() => void) | null {
  if (typeof window === "undefined") return null;
  const Ctx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!Ctx) return null;

  const ctx = new Ctx();
  let stopped = false;
  let timer: ReturnType<typeof setInterval> | null = null;

  const beep = (startAt: number, freq: number, duration: number, gain: number) => {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, ctx.currentTime + startAt);
    g.gain.exponentialRampToValueAtTime(gain, ctx.currentTime + startAt + 0.02);
    g.gain.exponentialRampToValueAtTime(
      0.0001,
      ctx.currentTime + startAt + duration,
    );
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start(ctx.currentTime + startAt);
    osc.stop(ctx.currentTime + startAt + duration + 0.05);
  };

  const cycle = () => {
    if (stopped) return;
    beep(0, 440, 0.35, 0.08);
    beep(0.45, 440, 0.35, 0.08);
    beep(0.95, 480, 0.4, 0.07);
    beep(1.45, 440, 0.35, 0.08);
  };

  cycle();
  timer = setInterval(cycle, 2800);

  return () => {
    stopped = true;
    if (timer) clearInterval(timer);
    ctx.close().catch(() => {});
  };
}

function stopSpeakingSafe() {
  if (typeof window !== "undefined" && window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
}

async function postTurn(body: unknown): Promise<TurnResponse> {
  try {
    const res = await fetch("/api/turn", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    if (!res.ok) {
      return {
        reply: "Sorry, could you say that again?",
        end_call: false,
        emergency: false,
        source: "fallback",
      };
    }
    const data = (await res.json()) as TurnResponse;
    return {
      reply: data.reply || "Sorry, could you say that again?",
      end_call: Boolean(data.end_call),
      emergency: Boolean(data.emergency),
      source: data.source ?? "fallback",
    };
  } catch {
    return {
      reply: "Sorry, could you say that again?",
      end_call: false,
      emergency: false,
      source: "fallback",
    };
  }
}

export default function PhonePage() {
  const [phase, setPhase] = useState<Phase>("BOOT");
  const [server, setServer] = useState<ServerState | null>(null);
  const [endedReason, setEndedReason] = useState<EndedReason>(null);
  const [callSeconds, setCallSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [contextText, setContextText] = useState<string | null>(null);
  const [voiceStatus, setVoiceStatus] = useState<VoiceStatus>("idle");
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [liveInterim, setLiveInterim] = useState("");
  const [brain, setBrain] = useState<"n8n" | "fallback" | null>(null);

  const phaseRef = useRef<Phase>("BOOT");
  const callIdRef = useRef<string | null>(null);
  const callTypeRef = useRef<string | null>(null);
  const attemptRef = useRef(0);
  const contextRef = useRef<string | null>(null);
  const stopRingRef = useRef<(() => void) | null>(null);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const pollingRef = useRef(false);
  const endingRef = useRef(false);
  const voiceRunRef = useRef(false);
  const transcriptRef = useRef<TranscriptEntry[]>([]);
  const voiceAbortRef = useRef(false);

  const setPhaseBoth = useCallback((p: Phase) => {
    phaseRef.current = p;
    setPhase(p);
  }, []);

  const stopRingtone = useCallback(() => {
    if (stopRingRef.current) {
      stopRingRef.current();
      stopRingRef.current = null;
    }
  }, []);

  const requestWakeLock = useCallback(async () => {
    try {
      if ("wakeLock" in navigator) {
        wakeLockRef.current = await navigator.wakeLock.request("screen");
      }
    } catch {
      // non-fatal
    }
  }, []);

  const pushTranscript = useCallback((entry: TranscriptEntry) => {
    transcriptRef.current = [...transcriptRef.current, entry];
    setTranscript(transcriptRef.current);
  }, []);

  const finishCall = useCallback(
    async (reason: "completed" | "missed" | "declined") => {
      if (endingRef.current) return;
      endingRef.current = true;
      voiceAbortRef.current = true;
      voiceRunRef.current = false;
      browserTransport.hangup();
      stopSpeakingSafe();
      stopRingtone();
      setVoiceStatus("ended");
      setEndedReason(reason);

      const callId = callIdRef.current;
      const callType = callTypeRef.current ?? "morning";
      const attempt = attemptRef.current;
      const transcriptCopy = [...transcriptRef.current];

      try {
        await fetch("/api/end", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            callId,
            callType,
            reason,
            attempt,
            transcript: transcriptCopy,
          }),
        });
      } catch {
        // local state still resets
      }

      callIdRef.current = null;
      contextRef.current = null;
      setContextText(null);
      setServer(null);
      setLiveInterim("");
      setPhaseBoth("ENDED");

      window.setTimeout(() => {
        endingRef.current = false;
        voiceAbortRef.current = false;
        transcriptRef.current = [];
        setTranscript([]);
        setEndedReason(null);
        setCallSeconds(0);
        setVoiceStatus("idle");
        setBrain(null);
        setPhaseBoth("IDLE");
      }, 1600);
    },
    [setPhaseBoth, stopRingtone],
  );

  const poll = useCallback(async () => {
    if (pollingRef.current) return;
    if (phaseRef.current === "BOOT" || phaseRef.current === "ENDED") return;
    pollingRef.current = true;
    try {
      const res = await fetch("/api/state", { cache: "no-store" });
      const data = (await res.json()) as ServerState;
      setServer(data);

      if (phaseRef.current === "IDLE" && data.status === "ringing" && data.callId) {
        callIdRef.current = data.callId;
        callTypeRef.current = data.callType ?? "morning";
        attemptRef.current = data.attempt ?? 0;
        contextRef.current = data.context ?? null;
        setContextText(data.context ?? null);
        setPhaseBoth("RINGING");
        setError(null);
        if ("vibrate" in navigator) {
          navigator.vibrate?.([400, 200, 400, 200, 600]);
        }
        if (!stopRingRef.current) {
          stopRingRef.current = ringtoneStart();
        }
      }

      if (phaseRef.current === "RINGING") {
        const age = data.ringAgeSeconds ?? 0;
        if (data.status === "idle") {
          stopRingtone();
          callIdRef.current = null;
          setContextText(null);
          setEndedReason("missed");
          setPhaseBoth("ENDED");
          window.setTimeout(() => {
            setEndedReason(null);
            setPhaseBoth("IDLE");
          }, 1400);
        } else if (age >= RING_TIMEOUT_SECONDS) {
          await finishCall("missed");
        }
      }
    } catch {
      // ignore transient poll errors
    } finally {
      pollingRef.current = false;
    }
  }, [finishCall, setPhaseBoth, stopRingtone]);

  const boot = useCallback(() => {
    setError(null);
    setEndedReason(null);
    setCallSeconds(0);
    setPhaseBoth("IDLE");
    warmVoices();

    void (async () => {
      try {
        if (navigator.mediaDevices?.getUserMedia) {
          const stream = await navigator.mediaDevices.getUserMedia({
            audio: true,
          });
          stream.getTracks().forEach((t) => t.stop());
        } else {
          setError(
            "Mic API unavailable on this origin (need HTTPS). Call UI still works.",
          );
        }
      } catch {
        setError(
          "Microphone permission blocked — allow mic for voice. Ring UI still works.",
        );
      }
      await requestWakeLock();
    })();
  }, [requestWakeLock, setPhaseBoth]);

  const runVoiceLoop = useCallback(
    async (callId: string, callType: string, context: string) => {
      if (voiceRunRef.current) return;
      voiceRunRef.current = true;
      voiceAbortRef.current = false;
      browserTransport.ring();

      const base = { callId, callType, context };

      try {
        setVoiceStatus("thinking");
        const greeting = await postTurn({
          ...base,
          history: [],
          userText: null,
          turnIndex: 0,
        });
        if (voiceAbortRef.current) return;
        setBrain(greeting.source === "n8n" ? "n8n" : "fallback");

        pushTranscript({ role: "ai", text: greeting.reply, ts: Date.now() });
        setLiveInterim("");
        setVoiceStatus("speaking");
        await browserTransport.speak(greeting.reply);
        if (voiceAbortRef.current) return;

        if (greeting.end_call) {
          await finishCall("completed");
          return;
        }

        let turnIndex = 1;
        let silenceStreak = 0;

        while (!voiceAbortRef.current && turnIndex < MAX_CALL_TURNS) {
          setVoiceStatus("listening");
          const heard = await browserTransport.listen({
            silenceMs: CARE_CONFIG.utteranceEndSilenceMs,
            timeoutMs: CARE_CONFIG.listenTimeoutMs,
            onInterim: (t) => setLiveInterim(t),
          });
          setLiveInterim("");

          if (voiceAbortRef.current) return;

          if (!heard) {
            silenceStreak += 1;
            if (silenceStreak === 1) {
              const rePrompt =
                "Are you still there? I could not hear you clearly.";
              pushTranscript({ role: "ai", text: rePrompt, ts: Date.now() });
              setVoiceStatus("speaking");
              await browserTransport.speak(rePrompt);
              continue;
            }
            const bye = "I will check on you another time. Goodbye.";
            pushTranscript({ role: "ai", text: bye, ts: Date.now() });
            pushTranscript({
              role: "grandma",
              text: "[no speech — call ended]",
              ts: Date.now(),
            });
            setVoiceStatus("speaking");
            await browserTransport.speak(bye);
            await finishCall("completed");
            return;
          }

          silenceStreak = 0;
          pushTranscript({ role: "grandma", text: heard, ts: Date.now() });

          setVoiceStatus("thinking");
          const turn = await postTurn({
            ...base,
            history: transcriptRef.current.map((e) => ({
              role: e.role,
              text: e.text,
            })),
            userText: heard,
            turnIndex,
          });
          if (voiceAbortRef.current) return;
          if (turn.source) setBrain(turn.source === "n8n" ? "n8n" : "fallback");

          pushTranscript({ role: "ai", text: turn.reply, ts: Date.now() });
          setVoiceStatus("speaking");
          await browserTransport.speak(turn.reply);
          if (voiceAbortRef.current) return;

          if (turn.end_call) {
            await finishCall("completed");
            return;
          }

          turnIndex += 1;
        }

        if (!voiceAbortRef.current) {
          const bye = "Thank you for talking with me. Goodbye, Grandma.";
          pushTranscript({ role: "ai", text: bye, ts: Date.now() });
          setVoiceStatus("speaking");
          await browserTransport.speak(bye);
          await finishCall("completed");
        }
      } finally {
        voiceRunRef.current = false;
      }
    },
    [finishCall, pushTranscript],
  );

  const accept = useCallback(async () => {
    const callId = callIdRef.current;
    if (!callId) return;
    stopRingtone();
    try {
      const res = await fetch("/api/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ callId }),
      });
      if (!res.ok) {
        setError("Could not accept call.");
        return;
      }
      setCallSeconds(0);
      transcriptRef.current = [];
      setTranscript([]);
      setLiveInterim("");
      setBrain(null);
      setVoiceStatus("thinking");
      setPhaseBoth("IN_CALL");
      await requestWakeLock();
      void runVoiceLoop(
        callId,
        callTypeRef.current ?? "morning",
        contextRef.current ?? "",
      );
    } catch {
      setError("Network error while accepting.");
    }
  }, [requestWakeLock, runVoiceLoop, setPhaseBoth, stopRingtone]);

  const decline = useCallback(() => {
    void finishCall("declined");
  }, [finishCall]);

  const hangUp = useCallback(() => {
    void finishCall("completed");
  }, [finishCall]);

  useEffect(() => {
    if (phase !== "IDLE" && phase !== "RINGING" && phase !== "IN_CALL") return;
    const tick = () => {
      void poll();
    };
    const id = window.setInterval(tick, 2000);
    const first = window.setTimeout(tick, 0);
    const onVisible = () => {
      if (document.visibilityState === "visible") tick();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("pageshow", onVisible);
    return () => {
      window.clearInterval(id);
      window.clearTimeout(first);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("pageshow", onVisible);
    };
  }, [phase, poll]);

  useEffect(() => {
    if (phase !== "IN_CALL") return;
    const id = window.setInterval(() => setCallSeconds((s) => s + 1), 1000);
    return () => window.clearInterval(id);
  }, [phase]);

  useEffect(() => {
    return () => {
      stopRingtone();
      browserTransport.hangup();
      wakeLockRef.current?.release().catch(() => {});
    };
  }, [stopRingtone]);

  const callerName = "Care Companion";
  const callLabel =
    server?.callType === "followup"
      ? "Follow-up call"
      : server?.callType === "evening"
        ? "Evening check-in"
        : server?.callType === "retry"
          ? "Retry check-in"
          : "Morning check-in";

  const voiceLabel =
    voiceStatus === "speaking"
      ? "Speaking..."
      : voiceStatus === "listening"
        ? "Listening..."
        : voiceStatus === "thinking"
          ? "Thinking..."
          : voiceStatus === "ended"
            ? "Call ended"
            : "Connected";

  return (
    <div className="noise relative min-h-dvh overflow-hidden bg-bg">
      <div className="pointer-events-none absolute inset-0 z-0">
        <div className="absolute left-1/2 top-[-20%] h-[70vh] w-[70vh] -translate-x-1/2 rounded-full bg-amber/12 blur-3xl" />
        <div className="absolute bottom-[-15%] right-[-10%] h-[45vh] w-[45vh] rounded-full bg-amber/8 blur-3xl" />
      </div>

      <div className="relative z-10 mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 pb-8 pt-5">
        <header className="flex items-center justify-between text-[11px] uppercase tracking-[0.22em] text-muted">
          <span>Raksha</span>
          <span className="flex items-center gap-2">
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                phase === "IN_CALL"
                  ? voiceStatus === "speaking"
                    ? "bg-ambersoft"
                    : voiceStatus === "listening"
                      ? "bg-accept"
                      : "bg-amber"
                  : phase === "RINGING"
                    ? "bg-decline"
                    : "bg-amber"
              }`}
            />
            {phase === "BOOT"
              ? "Standby"
              : phase === "IDLE"
                ? "Phone on"
                : phase === "RINGING"
                  ? "Incoming"
                  : phase === "IN_CALL"
                    ? "On call"
                    : "Ended"}
          </span>
        </header>

        <main className="flex flex-1 flex-col items-center justify-center py-8">
          {phase === "BOOT" && (
            <section className="rise flex w-full flex-col items-center gap-8 text-center">
              <div className="relative">
                <div className="absolute inset-0 rounded-full bg-amber/25 blur-2xl" />
                <div className="relative flex h-28 w-28 items-center justify-center rounded-full border border-amber/40 bg-panel shadow-[0_0_60px_rgba(245,158,11,0.18)]">
                  <span className="font-display text-4xl text-ambersoft">R</span>
                </div>
              </div>
              <div className="space-y-3">
                <p className="text-xs uppercase tracking-[0.28em] text-amber">
                  Elderly voice care
                </p>
                <h1 className="font-display text-4xl leading-tight text-ink">
                  Care Companion
                </h1>
                <p className="mx-auto max-w-[18rem] text-sm leading-relaxed text-muted">
                  Grandma&apos;s phone. Turn it on, keep this tab open, and the
                  family can call her.
                </p>
              </div>
              <button
                type="button"
                onClick={() => boot()}
                className="group w-full rounded-2xl bg-amber px-6 py-5 text-base font-semibold text-stone-950 shadow-[0_10px_40px_rgba(245,158,11,0.25)] transition hover:brightness-110 active:scale-[0.98]"
              >
                Start phone
              </button>
              <p className="max-w-[16rem] text-[11px] leading-relaxed text-muted">
                This tap unlocks the microphone and keeps the screen awake.
              </p>
              {error && (
                <p className="max-w-[18rem] rounded-xl border border-decline/40 bg-decline/10 px-3 py-2 text-xs text-decline">
                  {error}
                </p>
              )}
            </section>
          )}

          {phase === "IDLE" && (
            <section className="rise flex w-full flex-col items-center gap-8 text-center">
              <div className="relative breathe">
                <div className="absolute inset-0 rounded-full bg-amber/20 blur-2xl" />
                <div className="relative flex h-32 w-32 items-center justify-center rounded-full border border-line bg-panel">
                  <div className="flex h-20 w-20 items-center justify-center rounded-full bg-panel2">
                    <span className="font-display text-3xl text-ambersoft">
                      C
                    </span>
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <h2 className="font-display text-3xl">Ready for calls</h2>
                <p className="text-sm text-muted">
                  Phone is on · waiting for the family
                </p>
              </div>
              <div className="w-full rounded-2xl border border-line bg-panel/70 p-4 text-left">
                <p className="text-[11px] uppercase tracking-[0.2em] text-muted">
                  Patient
                </p>
                <p className="mt-1 text-lg font-medium">
                  {server?.patientName ?? "Grandma"}
                </p>
                <p className="mt-1 text-xs text-muted">
                  72 · Mysore · lives alone
                </p>
              </div>
              <button
                type="button"
                onClick={() => void finishCall("declined")}
                className="text-xs uppercase tracking-[0.2em] text-muted transition hover:text-ink"
              >
                Turn phone off
              </button>
            </section>
          )}

          {phase === "RINGING" && (
            <section className="rise flex w-full flex-col items-center gap-8 text-center">
              <p className="text-xs uppercase tracking-[0.28em] text-decline">
                Incoming call
              </p>

              <div className="relative mt-2">
                <span className="ring-pulse absolute inset-0 rounded-full border-2 border-decline/50" />
                <span
                  className="ring-pulse absolute inset-0 rounded-full border-2 border-decline/35"
                  style={{ animationDelay: "0.45s" }}
                />
                <div className="relative flex h-36 w-36 items-center justify-center rounded-full border border-line bg-panel shadow-[0_0_80px_rgba(244,63,94,0.2)]">
                  <div className="flex h-24 w-24 items-center justify-center rounded-full bg-panel2">
                    <span className="font-display text-4xl text-ambersoft">
                      C
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <h2 className="font-display text-4xl">{callerName}</h2>
                <p className="text-sm text-muted">{callLabel}</p>
                {contextText && (
                  <p className="mx-auto max-w-[17rem] rounded-xl border border-line bg-panel/60 px-3 py-2 text-[11px] leading-relaxed text-muted">
                    {contextText}
                  </p>
                )}
              </div>

              <div className="mt-2 grid w-full grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={decline}
                  className="flex flex-col items-center gap-2 rounded-2xl bg-decline/15 px-4 py-6 text-decline transition hover:bg-decline/25 active:scale-[0.97]"
                >
                  <span className="flex h-12 w-12 items-center justify-center rounded-full bg-decline text-xl">
                    ✕
                  </span>
                  <span className="text-sm font-semibold">Decline</span>
                </button>
                <button
                  type="button"
                  onClick={() => void accept()}
                  className="flex flex-col items-center gap-2 rounded-2xl bg-accept/15 px-4 py-6 text-accept transition hover:bg-accept/25 active:scale-[0.97]"
                >
                  <span className="flex h-12 w-12 items-center justify-center rounded-full bg-accept text-xl text-stone-950">
                    ☎
                  </span>
                  <span className="text-sm font-semibold">Accept</span>
                </button>
              </div>

              <p className="text-[11px] text-muted">
                Auto-ends as missed after {RING_TIMEOUT_SECONDS}s
              </p>
            </section>
          )}

          {phase === "IN_CALL" && (
            <section className="rise flex w-full flex-col items-center gap-5 text-center">
              <p className="text-xs uppercase tracking-[0.28em] text-accept">
                Connected
              </p>

              <div className="relative">
                <div className="absolute inset-0 rounded-full bg-accept/20 blur-2xl breathe" />
                <div className="relative flex h-24 w-24 items-center justify-center rounded-full border border-accept/40 bg-panel">
                  <span className="font-display text-3xl text-ambersoft">C</span>
                </div>
              </div>

              <div>
                <h2 className="font-display text-2xl">{callerName}</h2>
                <p className="mt-1 font-mono text-3xl tracking-widest text-ink">
                  {formatTimer(callSeconds)}
                </p>
                <p className="mt-1 text-sm text-ambersoft">{voiceLabel}</p>
                {brain && (
                  <p
                    className={`mt-1 text-[10px] uppercase tracking-[0.2em] ${
                      brain === "n8n" ? "text-accept" : "text-decline"
                    }`}
                  >
                    Brain: {brain === "n8n" ? "n8n live" : "offline fallback"}
                  </p>
                )}
              </div>

              <div className="flex h-8 items-end justify-center gap-1.5">
                {[0, 1, 2, 3, 4].map((i) => (
                  <span
                    key={i}
                    className={`eq-bar h-7 w-1.5 rounded-full ${
                      voiceStatus === "listening"
                        ? "bg-accept"
                        : voiceStatus === "speaking"
                          ? "bg-ambersoft"
                          : "bg-amber/40"
                    }`}
                    style={{
                      animationDelay: `${i * 0.12}s`,
                      animationPlayState:
                        voiceStatus === "listening" ||
                        voiceStatus === "speaking"
                          ? "running"
                          : "paused",
                    }}
                  />
                ))}
              </div>

              <div className="w-full rounded-2xl border border-line bg-panel/70 p-3 text-left">
                <p className="mb-2 text-[10px] uppercase tracking-[0.2em] text-amber">
                  Live transcript
                </p>
                <div className="max-h-40 space-y-2 overflow-y-auto text-[12px] leading-relaxed">
                  {transcript.length === 0 && !liveInterim && (
                    <p className="text-muted">
                      Say something after the greeting — e.g. &quot;hello&quot;.
                    </p>
                  )}
                  {transcript.map((entry, i) => (
                    <p key={`${entry.ts}-${i}`}>
                      <span
                        className={
                          entry.role === "ai" ? "text-ambersoft" : "text-accept"
                        }
                      >
                        {entry.role === "ai" ? "AI" : "Grandma"}:
                      </span>{" "}
                      <span className="text-ink/90">{entry.text}</span>
                    </p>
                  ))}
                  {liveInterim && (
                    <p className="text-muted italic">
                      Grandma: {liveInterim}…
                    </p>
                  )}
                </div>
              </div>

              {contextText && (
                <p className="w-full rounded-2xl border border-line bg-panel/70 p-3 text-left text-[11px] leading-relaxed text-muted">
                  <span className="mb-1 block text-[10px] uppercase tracking-[0.2em] text-amber">
                    Context
                  </span>
                  {contextText}
                </p>
              )}

              <button
                type="button"
                onClick={hangUp}
                className="mt-1 w-full rounded-2xl bg-decline px-6 py-4 font-semibold text-white shadow-[0_10px_40px_rgba(244,63,94,0.25)] transition hover:brightness-110 active:scale-[0.98]"
              >
                Hang up
              </button>
            </section>
          )}

          {phase === "ENDED" && (
            <section className="rise flex flex-col items-center gap-4 text-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-full border border-line bg-panel text-2xl">
                {endedReason === "completed"
                  ? "✓"
                  : endedReason === "declined"
                    ? "✕"
                    : "…"}
              </div>
              <h2 className="font-display text-3xl">
                {endedReason === "completed"
                  ? "Call ended"
                  : endedReason === "declined"
                    ? "Call declined"
                    : "No answer"}
              </h2>
              <p className="text-sm text-muted">Returning to standby…</p>
            </section>
          )}
        </main>

        <footer className="flex items-center justify-between gap-2 text-[10px] uppercase tracking-[0.18em] text-muted">
          <span className="truncate">
            UI {phase} · API {server?.status ?? "…"}
            {brain ? ` · ${brain === "n8n" ? "n8n" : "fb"}` : ""}
          </span>
          <a href="/dashboard" className="shrink-0 text-amber hover:underline">
            Dashboard
          </a>
        </footer>
      </div>
    </div>
  );
}
