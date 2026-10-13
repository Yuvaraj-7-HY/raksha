// app/api/voice/route.ts
// Twilio voice webhook — called when the patient answers.
// Each POST represents one conversational turn:
//   - Turn 0 (no SpeechResult): AI produces the opening greeting.
//   - Turn N (SpeechResult present): patient's words → Groq brain → TwiML reply.
//
// Flow:
//   Twilio dials → patient answers → POST /api/voice?callId=…&callType=…
//   → speak(reply) + <Gather speech> → patient talks
//   → POST /api/voice (same route, SpeechResult in body)
//   → repeat until end_call=true → <Hangup>

export const runtime = "nodejs"; // required for better-sqlite3 (via runTurn)

import { NextRequest, NextResponse } from "next/server";
import twilio from "twilio";
import { runTurn, type HistoryItem } from "@/lib/brain/turn";
import { MAX_CALL_TURNS, RING_TIMEOUT_SECONDS } from "@/lib/config";

const VoiceResponse = twilio.twiml.VoiceResponse;

// TTS voice — Polly.Aditi is a natural-sounding Indian English voice.
const TTS_VOICE = "Polly.Aditi" as const;
const TTS_LANG = "en-IN" as const;

// How long (seconds) Twilio waits for the patient to start speaking.
// Must be a string or "auto" per the Twilio SDK types.
const SPEECH_TIMEOUT = "5";

export async function POST(req: NextRequest) {
  // ── 1. Parse incoming form data from Twilio ────────────────────────────────
  const form = await req.formData();
  const speechResult = (form.get("SpeechResult") as string | null) ?? null;
  const confidence = parseFloat((form.get("Confidence") as string) ?? "0");

  // Call metadata is passed as query params on turn-0, and re-echoed by Twilio
  // as form fields on subsequent turns via <Gather action="…"> redirect.
  const qs = req.nextUrl.searchParams;
  const callId = (form.get("callId") as string) ?? qs.get("callId") ?? "twilio";
  const callType = (form.get("callType") as string) ?? qs.get("callType") ?? "morning";
  const context = (form.get("context") as string) ?? qs.get("context") ?? "";
  const attempt = parseInt(
    (form.get("attempt") as string) ?? qs.get("attempt") ?? "0",
    10
  );
  const turnIndex = parseInt(
    (form.get("turnIndex") as string) ?? qs.get("turnIndex") ?? "0",
    10
  );

  // History is a JSON-encoded array passed through hidden <Gather> params.
  let history: HistoryItem[] = [];
  try {
    const raw = (form.get("history") as string) ?? qs.get("history") ?? "[]";
    history = JSON.parse(raw) as HistoryItem[];
  } catch {
    history = [];
  }

  // Discard low-confidence speech (Twilio treats silence as empty string).
  const userText =
    speechResult && confidence >= 0.3 ? speechResult.trim() : null;

  // ── 2. Append patient's utterance to history ───────────────────────────────
  if (userText) {
    history.push({ role: "grandma", text: userText, ts: Date.now() });
  }

  // ── 3. Run the AI brain ───────────────────────────────────────────────────
  let reply = "Sorry, I did not catch that. Could you say that again?";
  let end_call = false;

  try {
    const result = await runTurn({
      callId,
      callType,
      context,
      history,
      userText,
      turnIndex,
    });
    reply = result.reply;
    end_call = result.end_call;
    // Force hang-up if we've hit the turn cap
    if (turnIndex >= MAX_CALL_TURNS) end_call = true;
  } catch (err) {
    console.error("[voice] runTurn error:", err);
  }

  // Append AI reply to history for the next turn.
  history.push({ role: "ai", text: reply, ts: Date.now() });

  // ── 4. Build TwiML ────────────────────────────────────────────────────────
  const twiml = new VoiceResponse();

  if (end_call) {
    twiml.say({ voice: TTS_VOICE, language: TTS_LANG }, reply);
    twiml.hangup();
  } else {
    // Build the action URL for the next turn, forwarding all metadata.
    const nextUrl = new URL(
      req.nextUrl.origin + "/api/voice"
    );
    nextUrl.searchParams.set("callId", callId);
    nextUrl.searchParams.set("callType", callType);
    nextUrl.searchParams.set("context", context);
    nextUrl.searchParams.set("attempt", String(attempt));
    nextUrl.searchParams.set("turnIndex", String(turnIndex + 1));
    nextUrl.searchParams.set("history", JSON.stringify(history));

    const gather = twiml.gather({
      input: ["speech"],
      action: nextUrl.toString(),
      method: "POST",
      speechTimeout: SPEECH_TIMEOUT,
      language: TTS_LANG,
    });

    gather.say({ voice: TTS_VOICE, language: TTS_LANG }, reply);

    // If patient is silent for RING_TIMEOUT_SECONDS, redirect back (gentle nudge).
    const retryUrl = new URL(req.nextUrl.origin + "/api/voice");
    retryUrl.searchParams.set("callId", callId);
    retryUrl.searchParams.set("callType", callType);
    retryUrl.searchParams.set("context", context);
    retryUrl.searchParams.set("attempt", String(attempt));
    retryUrl.searchParams.set("turnIndex", String(turnIndex + 1));
    retryUrl.searchParams.set("history", JSON.stringify(history));
    twiml.redirect({ method: "POST" }, retryUrl.toString());
  }

  return new NextResponse(twiml.toString(), {
    headers: { "Content-Type": "text/xml; charset=utf-8" },
  });
}
