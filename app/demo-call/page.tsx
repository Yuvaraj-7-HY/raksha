// app/demo-call/page.tsx
// Simulated call interface for Raksha with real-time Speech-to-Text -> n8n -> Voice output.

"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { speak, stopSpeaking } from "@/lib/speech/synthesizer";
import { listenOnce, speechRecognitionSupported } from "@/lib/speech/recognizer";

interface RingingCall {
  id: string;
  attempt_no: number;
  patient_name?: string;
  patient_id?: string;
}

interface ChatMessage {
  role: "assistant" | "user";
  text: string;
  timestamp: string;
}

export default function DemoCallPage() {
  const [activeCall, setActiveCall] = useState<RingingCall | null>(null);
  const [loading, setLoading] = useState(true);
  const [callActive, setCallActive] = useState(false);
  const [callDuration, setCallDuration] = useState(0);

  // Voice & n8n Conversation State
  const [conversation, setConversation] = useState<ChatMessage[]>([]);
  const [callStatus, setCallStatus] = useState<"idle" | "ringing" | "ai_speaking" | "listening" | "sending_to_n8n">("idle");
  const [currentTranscription, setCurrentTranscription] = useState("");
  const [turnIndex, setTurnIndex] = useState(0);
  const [manualText, setManualText] = useState("");

  const [patients, setPatients] = useState<any[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState("");
  const [triggering, setTriggering] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const abortRef = useRef(false);

  // Poll /api/demo-state every 2s
  useEffect(() => {
    let isMounted = true;
    async function checkState() {
      try {
        const res = await fetch("/api/demo-state");
        const data = await res.json();
        if (isMounted) {
          if (data.call && !callActive) {
            setActiveCall(data.call);
            setCallStatus("ringing");
          } else if (!data.call && !callActive) {
            setActiveCall(null);
            setCallStatus("idle");
          }
          setLoading(false);
        }
      } catch (err) {
        console.error("Error polling demo state:", err);
      }
    }
    checkState();
    const interval = setInterval(checkState, 2000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [callActive]);

  // Load patients list
  useEffect(() => {
    fetch("/api/patients")
      .then((r) => r.json())
      .then((d) => {
        if (d.patients && d.patients.length > 0) {
          setPatients(d.patients);
          setSelectedPatientId(d.patients[0].id);
        }
      })
      .catch(() => {});
  }, []);

  // Call duration counter
  useEffect(() => {
    let timer: any;
    if (callActive) {
      timer = setInterval(() => setCallDuration((d) => d + 1), 1000);
    } else {
      setCallDuration(0);
    }
    return () => clearInterval(timer);
  }, [callActive]);

  const formatDuration = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, "0");
    const s = (secs % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  /**
   * Starts or Answers the simulated call.
   * Kicks off the AI greeting, then listens for speech, sends to n8n, and speaks back!
   */
  const handleAnswerCall = async () => {
    abortRef.current = false;
    setCallActive(true);
    setTurnIndex(0);

    const initialGreeting = "Hello. This is Raksha. Did you take your medicines today?";
    const initialMsg: ChatMessage = {
      role: "assistant",
      text: initialGreeting,
      timestamp: new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }),
    };

    setConversation([initialMsg]);
    setCallStatus("ai_speaking");
    setStatusMessage("🗣️ Raksha is speaking to you...");

    // 1. Speak initial question
    await speak(initialGreeting);

    if (abortRef.current) return;

    // 2. Start voice turn loop
    runVoiceTurnLoop(1, [initialMsg]);
  };

  /**
   * The core speech loop: Listen -> Send to n8n -> Speak answer back
   */
  const runVoiceTurnLoop = async (currentTurn: number, historySoFar: ChatMessage[]) => {
    if (abortRef.current) return;

    setCallStatus("listening");
    setStatusMessage("🎙️ Listening to you... Speak now into your microphone.");
    setCurrentTranscription("");

    let userTranscript: string | null = null;

    if (speechRecognitionSupported()) {
      userTranscript = await listenOnce({
        lang: "en-IN",
        silenceMs: 1400,
        timeoutMs: 12000,
        shouldAbort: () => abortRef.current,
        onInterim: (text) => setCurrentTranscription(text),
      });
    }

    if (abortRef.current) return;

    // If no microphone input detected via speech recognition, pause and let user talk or type
    if (!userTranscript || !userTranscript.trim()) {
      setStatusMessage("⏳ Didn't hear anything. You can speak now or type below!");
      return;
    }

    await processTranscription(userTranscript.trim(), currentTurn, historySoFar);
  };

  /**
   * Sends the user's transcript to n8n and speaks back the response
   */
  const processTranscription = async (transcript: string, currentTurn: number, historySoFar: ChatMessage[]) => {
    const userMsg: ChatMessage = {
      role: "user",
      text: transcript,
      timestamp: new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }),
    };

    const updatedHistory = [...historySoFar, userMsg];
    setConversation(updatedHistory);
    setCurrentTranscription("");
    setCallStatus("sending_to_n8n");
    setStatusMessage("⚡ Sending transcription to n8n workflow...");

    try {
      const res = await fetch("/api/n8n/turn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          callId: activeCall?.id || `sim_${Date.now()}`,
          callType: "medication_check",
          userText: transcript,
          turnIndex: currentTurn,
          history: updatedHistory.map((m) => ({ role: m.role, text: m.text })),
          patientId: selectedPatientId || activeCall?.patient_id,
        }),
      });

      const n8nData = await res.json();
      const n8nReply = n8nData.reply || "Thank you. Take care and stay healthy!";

      const aiReplyMsg: ChatMessage = {
        role: "assistant",
        text: n8nReply,
        timestamp: new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }),
      };

      const finalHistory = [...updatedHistory, aiReplyMsg];
      setConversation(finalHistory);
      setCallStatus("ai_speaking");
      setStatusMessage(`🗣️ n8n Answer: "${n8nReply}"`);

      // 3. Speak the answer returned by n8n
      await speak(n8nReply);

      if (abortRef.current) return;

      if (n8nData.end_call) {
        setStatusMessage("✅ Call completed and resolved via n8n.");
        setTimeout(() => handleHangUp(), 2000);
      } else {
        // Continue conversation loop
        setTurnIndex(currentTurn + 1);
        runVoiceTurnLoop(currentTurn + 1, finalHistory);
      }
    } catch (err: any) {
      console.error("Error communicating with n8n:", err);
      setStatusMessage("⚠️ n8n error. Call completed.");
      setTimeout(() => handleHangUp(), 2000);
    }
  };

  const handleManualSend = () => {
    if (!manualText.trim() || callStatus === "sending_to_n8n") return;
    const text = manualText.trim();
    setManualText("");
    processTranscription(text, turnIndex + 1, conversation);
  };

  const handleHangUp = () => {
    abortRef.current = true;
    stopSpeaking();
    setCallActive(false);
    setCallStatus("idle");
    setActiveCall(null);
    setStatusMessage("Call ended.");
  };

  // Quick Trigger buttons
  const handleTriggerSimulatedCall = async () => {
    if (!selectedPatientId) return;
    setTriggering(true);
    setStatusMessage("📞 Triggering simulated phone call...");
    try {
      const res = await fetch("/api/trigger-call", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-care-secret": "2ea1c4261d21c5a1ecfac162fd6c141cbc2fd30341508a9dce9f9ed241674b82",
        },
        body: JSON.stringify({ patient_id: selectedPatientId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setStatusMessage("Incoming call ringing! Click Answer to start speaking.");
    } catch (e: any) {
      setStatusMessage(`Error: ${e.message}`);
    } finally {
      setTriggering(false);
    }
  };

  const handleTriggerTelegramCheck = async () => {
    if (!selectedPatientId) return;
    setTriggering(true);
    setStatusMessage("📲 Sending interactive check to your Telegram bot...");
    try {
      const res = await fetch("/api/telegram/trigger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patient_id: selectedPatientId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setStatusMessage("✅ Check sent to Telegram! Open @Raksha777bot and click an option.");
    } catch (e: any) {
      setStatusMessage(`Error: ${e.message}`);
    } finally {
      setTriggering(false);
    }
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(135deg, #0F172A 0%, #042F2E 50%, #0F172A 100%)",
      color: "#F8FAFC",
      fontFamily: "system-ui, -apple-system, sans-serif",
      padding: "24px 16px",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
    }}>
      {/* Top Header */}
      <div style={{
        maxWidth: 600,
        width: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 20,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 26 }}>🛡️</span>
          <div>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: "#2DD4BF" }}>
              Raksha Voice & Care
            </h1>
            <p style={{ margin: 0, fontSize: 11, color: "#94A3B8" }}>
              Speech-to-Text ➔ n8n Brain ➔ Voice Answer
            </p>
          </div>
        </div>
        <Link
          href="/dashboard"
          style={{
            fontSize: 12,
            fontWeight: 700,
            padding: "8px 14px",
            borderRadius: 8,
            background: "rgba(255,255,255,0.08)",
            color: "#E2E8F0",
            textDecoration: "none",
            border: "1px solid rgba(255,255,255,0.15)",
          }}
        >
          Dashboard ➔
        </Link>
      </div>

      {/* Main Call Container */}
      <div style={{
        maxWidth: 540,
        width: "100%",
        background: "rgba(30, 41, 59, 0.85)",
        backdropFilter: "blur(16px)",
        border: "1px solid rgba(45, 212, 191, 0.25)",
        borderRadius: 24,
        padding: "28px 24px",
        boxShadow: "0 20px 40px -15px rgba(0,0,0,0.5)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}>

        {/* ── STATE 1: ACTIVE IN-CALL CONVERSATION ── */}
        {callActive ? (
          <div style={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "center" }}>
            {/* Call Header */}
            <div style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              width: "100%",
              borderBottom: "1px solid rgba(255,255,255,0.1)",
              paddingBottom: 14,
              marginBottom: 16,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  background: "#10B981",
                  display: "inline-block",
                  boxShadow: "0 0 10px #10B981",
                }} />
                <span style={{ fontSize: 14, fontWeight: 700, color: "#10B981" }}>
                  CONNECTED
                </span>
                <span style={{ fontSize: 13, color: "#94A3B8" }}>
                  • {formatDuration(callDuration)}
                </span>
              </div>
              <span style={{ fontSize: 12, background: "rgba(45,212,191,0.15)", color: "#2DD4BF", padding: "4px 8px", borderRadius: 6, fontWeight: 700 }}>
                n8n Active
              </span>
            </div>

            {/* Live Status Orb */}
            <div style={{
              margin: "12px 0 18px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 8,
            }}>
              <div style={{
                width: 76,
                height: 76,
                borderRadius: "50%",
                background: callStatus === "listening"
                  ? "radial-gradient(circle, #EF4444 0%, #7F1D1D 100%)"
                  : callStatus === "ai_speaking"
                  ? "radial-gradient(circle, #0D9488 0%, #115E59 100%)"
                  : "radial-gradient(circle, #3B82F6 0%, #1E3A8A 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 32,
                boxShadow: callStatus === "listening"
                  ? "0 0 24px rgba(239, 68, 68, 0.6)"
                  : "0 0 24px rgba(13, 148, 136, 0.6)",
                transition: "all 0.3s ease",
              }}>
                {callStatus === "listening" ? "🎙️" : callStatus === "ai_speaking" ? "🗣️" : "⚡"}
              </div>

              <span style={{ fontSize: 13, fontWeight: 700, color: callStatus === "listening" ? "#FCA5A5" : "#5EEAD4" }}>
                {callStatus === "listening"
                  ? "Listening to you... Speak now"
                  : callStatus === "ai_speaking"
                  ? "Raksha Speaking (TTS)"
                  : "Sending transcription to n8n..."}
              </span>

              {currentTranscription && (
                <div style={{
                  background: "rgba(239,68,68,0.15)",
                  border: "1px solid rgba(239,68,68,0.3)",
                  padding: "6px 12px",
                  borderRadius: 8,
                  fontSize: 13,
                  color: "#FCA5A5",
                  maxWidth: 380,
                  textAlign: "center",
                }}>
                  Live: &ldquo;{currentTranscription}&rdquo;
                </div>
              )}
            </div>

            {/* Conversation Bubbles Log */}
            <div style={{
              width: "100%",
              maxHeight: 220,
              overflowY: "auto",
              background: "rgba(15, 23, 42, 0.6)",
              borderRadius: 14,
              padding: "12px 14px",
              display: "flex",
              flexDirection: "column",
              gap: 10,
              boxSizing: "border-box",
              marginBottom: 16,
              border: "1px solid rgba(255,255,255,0.08)",
            }}>
              {conversation.map((msg, i) => (
                <div
                  key={i}
                  style={{
                    alignSelf: msg.role === "user" ? "flex-end" : "flex-start",
                    maxWidth: "85%",
                    background: msg.role === "user" ? "#0F766E" : "#334155",
                    color: "#fff",
                    padding: "8px 12px",
                    borderRadius: 12,
                    fontSize: 13,
                    lineHeight: 1.4,
                  }}
                >
                  <div style={{ fontSize: 10, opacity: 0.75, marginBottom: 2 }}>
                    {msg.role === "assistant" ? "🤖 Raksha (via n8n)" : "👤 You"} • {msg.timestamp}
                  </div>
                  <div>{msg.text}</div>
                </div>
              ))}
            </div>

            {/* Spoken Text Fallback / Manual Input */}
            <div style={{ display: "flex", gap: 8, width: "100%", marginBottom: 16 }}>
              <input
                type="text"
                placeholder="Or type here if mic is blocked..."
                value={manualText}
                onChange={(e) => setManualText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleManualSend()}
                style={{
                  flex: 1,
                  background: "rgba(255,255,255,0.07)",
                  border: "1px solid rgba(255,255,255,0.18)",
                  borderRadius: 10,
                  padding: "10px 14px",
                  color: "#fff",
                  fontSize: 13,
                }}
              />
              <button
                type="button"
                onClick={handleManualSend}
                disabled={!manualText.trim()}
                style={{
                  padding: "10px 16px",
                  borderRadius: 10,
                  background: "#0D9488",
                  color: "#fff",
                  border: "none",
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                Send
              </button>
            </div>

            {/* Hang Up Button */}
            <button
              type="button"
              onClick={handleHangUp}
              style={{
                width: "100%",
                padding: "14px",
                borderRadius: 12,
                background: "#DC2626",
                color: "#fff",
                border: "none",
                fontWeight: 800,
                fontSize: 15,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                boxShadow: "0 8px 16px rgba(220,38,38,0.3)",
              }}
            >
              <span>🔴</span> End Call (Hang Up)
            </button>
          </div>
        ) : (
          /* ── STATE 2: INCOMING CALL OR IDLE SCREEN ── */
          <div style={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "center" }}>
            {activeCall ? (
              /* Incoming Call Alert */
              <div style={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "center" }}>
                <div style={{
                  width: 72,
                  height: 72,
                  borderRadius: "50%",
                  background: "radial-gradient(circle, #2DD4BF 0%, #0F766E 100%)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 32,
                  marginBottom: 14,
                  animation: "bounce 1s infinite alternate",
                  boxShadow: "0 0 24px rgba(45,212,191,0.6)",
                }}>
                  📞
                </div>

                <div style={{
                  fontSize: 11,
                  fontWeight: 800,
                  color: "#2DD4BF",
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  marginBottom: 4,
                }}>
                  INCOMING CALL • ATTEMPT {activeCall.attempt_no}
                </div>

                <h2 style={{ margin: "0 0 16px", fontSize: 24, fontWeight: 900, color: "#fff" }}>
                  Call from Raksha Care
                </h2>

                <p style={{ margin: "0 0 20px", fontSize: 13, color: "#94A3B8", textAlign: "center", lineHeight: 1.5 }}>
                  Click <b>Answer Call</b> to start the conversation. Raksha will speak to you, listen to your answer via microphone, and forward it to n8n!
                </p>

                <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 12, width: "100%" }}>
                  <button
                    type="button"
                    onClick={handleAnswerCall}
                    style={{
                      padding: "16px",
                      borderRadius: 14,
                      background: "linear-gradient(135deg, #10B981 0%, #059669 100%)",
                      color: "#fff",
                      fontSize: 18,
                      fontWeight: 800,
                      border: "none",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 8,
                      boxShadow: "0 8px 20px rgba(16,185,129,0.35)",
                    }}
                  >
                    <span>📞</span> Answer & Speak Now
                  </button>
                </div>
              </div>
            ) : (
              /* Idle Waiting Screen with Instant Launch */
              <div style={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "center" }}>
                <div style={{
                  width: 64,
                  height: 64,
                  borderRadius: "50%",
                  background: "rgba(255,255,255,0.06)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 28,
                  marginBottom: 12,
                  color: "#64748B",
                }}>
                  📴
                </div>

                <h2 style={{ margin: "0 0 6px", fontSize: 20, fontWeight: 800, color: "#F8FAFC" }}>
                  Simulated Voice Call Ready
                </h2>

                <p style={{ margin: "0 0 20px", fontSize: 13, color: "#94A3B8", textAlign: "center", maxWidth: 400, lineHeight: 1.5 }}>
                  Experience the full voice flow: Speak into your mic ➔ Transcription sent to <b>n8n</b> ➔ n8n answer read back to you on call!
                </p>

                {/* Direct Call Button */}
                <button
                  type="button"
                  onClick={handleAnswerCall}
                  style={{
                    width: "100%",
                    padding: "16px",
                    borderRadius: 14,
                    background: "linear-gradient(135deg, #0D9488 0%, #047857 100%)",
                    color: "#fff",
                    fontSize: 16,
                    fontWeight: 800,
                    border: "none",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 10,
                    marginBottom: 20,
                    boxShadow: "0 10px 24px -6px rgba(13,148,136,0.5)",
                  }}
                >
                  <span>🎙️</span> Start Simulated Voice Call (n8n Loop)
                </button>

                {/* Patient selection & Trigger controls */}
                <div style={{
                  width: "100%",
                  background: "rgba(15,23,42,0.5)",
                  borderRadius: 14,
                  padding: "16px",
                  border: "1px solid rgba(255,255,255,0.08)",
                  boxSizing: "border-box",
                }}>
                  <p style={{ margin: "0 0 10px", fontSize: 12, fontWeight: 700, color: "#94A3B8" }}>
                    Select Patient & Dispatch:
                  </p>
                  <div style={{ display: "flex", gap: 8, flexDirection: "column" }}>
                    <select
                      value={selectedPatientId}
                      onChange={(e) => setSelectedPatientId(e.target.value)}
                      style={{
                        padding: "10px 12px",
                        borderRadius: 8,
                        background: "rgba(255,255,255,0.08)",
                        border: "1px solid rgba(255,255,255,0.15)",
                        color: "#fff",
                        fontSize: 13,
                      }}
                    >
                      {patients.map((p) => (
                        <option key={p.id} value={p.id} style={{ background: "#1E293B", color: "#fff" }}>
                          {p.name} ({p.phone})
                        </option>
                      ))}
                    </select>

                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        type="button"
                        onClick={handleTriggerSimulatedCall}
                        disabled={triggering}
                        style={{
                          flex: 1,
                          padding: "10px",
                          borderRadius: 8,
                          background: "#334155",
                          color: "#fff",
                          border: "none",
                          fontSize: 12,
                          fontWeight: 700,
                          cursor: "pointer",
                        }}
                      >
                        📞 Trigger Phone Ring
                      </button>
                      <button
                        type="button"
                        onClick={handleTriggerTelegramCheck}
                        disabled={triggering}
                        style={{
                          flex: 1,
                          padding: "10px",
                          borderRadius: 8,
                          background: "#0284C7",
                          color: "#fff",
                          border: "none",
                          fontSize: 12,
                          fontWeight: 700,
                          cursor: "pointer",
                        }}
                      >
                        📲 Telegram Check
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Live Status Message */}
        {statusMessage && (
          <div style={{
            marginTop: 18,
            fontSize: 12,
            fontWeight: 600,
            color: "#2DD4BF",
            textAlign: "center",
          }}>
            {statusMessage}
          </div>
        )}
      </div>
    </div>
  );
}
