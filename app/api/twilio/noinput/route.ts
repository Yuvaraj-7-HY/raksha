// app/api/twilio/noinput/route.ts
// Public: Twilio redirects here on silence — re-prompt once, then hangup

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import twilio from "twilio";
import { validateTwilioSignature } from "@/lib/twilio";
import { getCall, incrementNoInput, getCallsDb } from "@/lib/calls-db";
import { PUBLIC_BASE_URL, TWILIO_AUTH_TOKEN, TWILIO_VALIDATE } from "@/lib/config";

const VoiceResponse = twilio.twiml.VoiceResponse;

const REPROMPT = "Are you still there? I could not hear you clearly.";
const GOODBYE = "I will check on you another time. Goodbye.";

export async function POST(req: Request) {
  // Validate Twilio signature
  const signature = req.headers.get("x-twilio-signature");
  const url = `${PUBLIC_BASE_URL}/api/twilio/noinput?${req.url.split("?")[1] ?? ""}`;
  const formData = await req.formData();
  const params: Record<string, string> = {};
  for (const [key, value] of formData.entries()) params[key] = String(value);

  if (TWILIO_VALIDATE && !validateTwilioSignature(TWILIO_AUTH_TOKEN, signature, url, params)) {
    console.warn("[twilio/noinput] Invalid signature");
    return new Response("Unauthorized", { status: 401 });
  }

  const callId = params.callId ?? new URL(req.url).searchParams.get("callId");
  if (!callId) {
    const vr = new VoiceResponse(); vr.say(GOODBYE); vr.hangup();
    return new Response(vr.toString(), { headers: { "Content-Type": "text/xml" } });
  }

  const count = incrementNoInput(callId);
  const vr = new VoiceResponse();

  if (count === 1) {
    // First silence — re-prompt
    const gather = vr.gather({
      input: ["speech"],
      action: `${PUBLIC_BASE_URL}/api/twilio/turn?callId=${callId}`,
      method: "POST",
      speechTimeout: "auto",
      language: "en-IN",
    });
    gather.say(REPROMPT);
    vr.redirect({ method: "POST" }, `${PUBLIC_BASE_URL}/api/twilio/noinput?callId=${callId}`);
  } else {
    // Second silence — goodbye and hangup
    vr.say(GOODBYE);
    vr.hangup();
    // Mark call as ended due to no response
    getCallsDb().prepare("UPDATE calls SET ended_at = ?, status = 'completed' WHERE id = ?").run(new Date().toISOString(), callId);
  }

  return new Response(vr.toString(), { headers: { "Content-Type": "text/xml" } });
}