// app/api/twilio/voice/route.ts
// Public: Twilio calls this when call is answered — returns TwiML with greeting

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import twilio from "twilio";
import { twilioClient, TWILIO_FROM_NUMBER, validateTwilioSignature } from "@/lib/twilio";
import { getCall, appendHistory, updateCallStatus } from "@/lib/calls-db";
import { PUBLIC_BASE_URL, TWILIO_AUTH_TOKEN, TWILIO_VALIDATE, CARE_SHARED_SECRET, N8N_BASE_URL, N8N_WEBHOOK_PREFIX } from "@/lib/config";

const VoiceResponse = twilio.twiml.VoiceResponse;

async function callN8nTurn0(callId: string, callType: string, context: string | null): Promise<{ reply: string; end_call: boolean; emergency: boolean }> {
  const url = `${N8N_BASE_URL}/${N8N_WEBHOOK_PREFIX}/care-turn`;
  const body = {
    callId,
    callType,
    context: context ?? "",
    history: [],
    userText: null,
    turnIndex: 0,
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6000);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Care-Secret": CARE_SHARED_SECRET,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
      cache: "no-store",
    });
    clearTimeout(timeout);
    if (!res.ok) throw new Error(`n8n responded ${res.status}`);
    const data = await res.json();
    return {
      reply: data.reply ?? "Good morning, Grandma. How are you feeling today?",
      end_call: Boolean(data.end_call),
      emergency: Boolean(data.emergency),
    };
  } catch (e) {
    clearTimeout(timeout);
    console.warn("[twilio/voice] n8n call failed, using fallback:", e);
    return {
      reply: "Good morning, Grandma. How are you feeling today?",
      end_call: false,
      emergency: false,
    };
  }
}

export async function POST(req: Request) {
  // Validate Twilio signature
  const signature = req.headers.get("x-twilio-signature");
  const url = `${PUBLIC_BASE_URL}/api/twilio/voice?${req.url.split("?")[1] ?? ""}`;
  const formData = await req.formData();
  const params: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    params[key] = String(value);
  }

  if (TWILIO_VALIDATE && !validateTwilioSignature(TWILIO_AUTH_TOKEN, signature, url, params)) {
    console.warn("[twilio/voice] Invalid signature");
    return new Response("Unauthorized", { status: 401 });
  }

  const callId = params.callId ?? new URL(req.url).searchParams.get("callId");
  if (!callId) {
    console.error("[twilio/voice] Missing callId");
    const vr = new VoiceResponse();
    vr.say("Configuration error. Goodbye.");
    vr.hangup();
    return new Response(vr.toString(), { headers: { "Content-Type": "text/xml" } });
  }

  // Get call record
  const call = getCall(callId);
  if (!call) {
    console.error("[twilio/voice] Call not found:", callId);
    const vr = new VoiceResponse();
    vr.say("Call not found. Goodbye.");
    vr.hangup();
    return new Response(vr.toString(), { headers: { "Content-Type": "text/xml" } });
  }

  // Update status to in-progress
  updateCallStatus(callId, "in-progress", params.CallSid);

  // Get greeting from n8n (turn 0)
  const { reply, end_call, emergency } = await callN8nTurn0(callId, call.call_type, call.context);

  // Save greeting to history
  appendHistory(callId, { role: "ai", text: reply, ts: Date.now() });
  if (emergency) {
    const db = await import("@/lib/calls-db").then(m => m.getCallsDb());
    db.prepare("UPDATE calls SET emergency = 1 WHERE id = ?").run(callId);
  }

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
      language: "en-IN",
    });
    gather.say(reply);
    vr.redirect({ method: "POST" }, `${PUBLIC_BASE_URL}/api/twilio/noinput?callId=${callId}`);
  }

  return new Response(vr.toString(), { headers: { "Content-Type": "text/xml" } });
}