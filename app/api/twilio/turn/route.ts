// app/api/twilio/turn/route.ts
// Public: Twilio posts SpeechResult here — calls n8n W1, returns next TwiML

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import twilio from "twilio";
import { validateTwilioSignature } from "@/lib/twilio";
import { getCall, appendHistory, updateCallStatus, setReplySource, setEmergency, getCallsDb, parseHistory } from "@/lib/calls-db";
import { PUBLIC_BASE_URL, TWILIO_AUTH_TOKEN, TWILIO_VALIDATE, CARE_SHARED_SECRET, N8N_BASE_URL, N8N_WEBHOOK_PREFIX } from "@/lib/config";

const VoiceResponse = twilio.twiml.VoiceResponse;

async function callN8nTurn(callId: string, callType: string, context: string | null, history: { role: string; text: string; ts: number }[], userText: string, turnIndex: number): Promise<{ reply: string; end_call: boolean; emergency: boolean; llm_ok: boolean }> {
  const url = `${N8N_BASE_URL}/${N8N_WEBHOOK_PREFIX}/care-turn`;
  const body = { callId, callType, context: context ?? "", history, userText, turnIndex };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6000);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Care-Secret": CARE_SHARED_SECRET },
      body: JSON.stringify(body),
      signal: controller.signal,
      cache: "no-store",
    });
    clearTimeout(timeout);
    if (!res.ok) throw new Error(`n8n responded ${res.status}`);
    const data = await res.json();
    return {
      reply: data.reply ?? "Sorry, could you say that again?",
      end_call: Boolean(data.end_call),
      emergency: Boolean(data.emergency),
      llm_ok: Boolean(data.llm_ok),
    };
  } catch (e) {
    clearTimeout(timeout);
    console.warn("[twilio/turn] n8n call failed, using fallback:", e);
    const isLastTurn = turnIndex >= 7;
    return {
      reply: isLastTurn ? "Thank you, Grandma. Take care. Goodbye." : "Sorry, could you say that again?",
      end_call: isLastTurn,
      emergency: false,
      llm_ok: false,
    };
  }
}

export async function POST(req: Request) {
  // Validate Twilio signature
  const signature = req.headers.get("x-twilio-signature");
  const url = `${PUBLIC_BASE_URL}/api/twilio/turn?${req.url.split("?")[1] ?? ""}`;
  const formData = await req.formData();
  const params: Record<string, string> = {};
  for (const [key, value] of formData.entries()) params[key] = String(value);

  if (TWILIO_VALIDATE && !validateTwilioSignature(TWILIO_AUTH_TOKEN, signature, url, params)) {
    console.warn("[twilio/turn] Invalid signature");
    return new Response("Unauthorized", { status: 401 });
  }

  const callId = params.callId ?? new URL(req.url).searchParams.get("callId");
  const speechResult = (params.SpeechResult ?? "").trim();
  const confidence = params.Confidence ? parseFloat(params.Confidence) : 1;

  if (!callId) {
    console.error("[twilio/turn] Missing callId");
    const vr = new VoiceResponse(); vr.say("Configuration error. Goodbye."); vr.hangup();
    return new Response(vr.toString(), { headers: { "Content-Type": "text/xml" } });
  }

  const call = getCall(callId);
  if (!call) {
    console.error("[twilio/turn] Call not found:", callId);
    const vr = new VoiceResponse(); vr.say("Call not found. Goodbye."); vr.hangup();
    return new Response(vr.toString(), { headers: { "Content-Type": "text/xml" } });
  }

  // No speech detected
  if (!speechResult) {
    const vr = new VoiceResponse();
    vr.redirect({ method: "POST" }, `${PUBLIC_BASE_URL}/api/twilio/noinput?callId=${callId}`);
    return new Response(vr.toString(), { headers: { "Content-Type": "text/xml" } });
  }

  // Save user speech to history
  appendHistory(callId, { role: "grandma", text: speechResult, ts: Date.now() });

  // Get full history for n8n
  const history = parseHistory(call.history_json);

  // Call n8n W1 for next turn
  const { reply, end_call, emergency, llm_ok } = await callN8nTurn(callId, call.call_type, call.context, history, speechResult, call.turn_index);

  // Save AI reply to history
  appendHistory(callId, { role: "ai", text: reply, ts: Date.now() });
  setReplySource(callId, llm_ok ? "n8n" : "fallback");
  if (emergency) setEmergency(callId, true);

  // Build TwiML
  const vr = new VoiceResponse();

  if (end_call) {
    vr.say(reply);
    vr.hangup();
  } else {
    const gather = vr.gather({
      input: ["speech"],
      action: `${PUBLIC_BASE_URL}/api/twilio/turn?callId=${callId}`,
      method: "POST",
      speechTimeout: "auto",
      language: "en-US",
      enhanced: true,
      hints: "yes,no,okay,good,bad,fine,pain,hurt,medicine,tablet,morning,evening,took,taken,did not,didn't,hello,hi,bye,feeling,feel,took,not,none",
      profanityFilter: false,
    });
    gather.say(reply);
    vr.redirect({ method: "POST" }, `${PUBLIC_BASE_URL}/api/twilio/noinput?callId=${callId}`);
  }

  return new Response(vr.toString(), { headers: { "Content-Type": "text/xml" } });
}