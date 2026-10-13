// app/api/voice/simple/route.ts
// Simple DTMF medicine check-in IVR.
// Threads patientId + CallSid through to /api/gather via the action URL.

import { NextRequest, NextResponse } from "next/server";
import twilio from "twilio";

export async function POST(req: NextRequest) {
  const qs = req.nextUrl.searchParams;
  const form = await req.formData();

  // patientId is set when the call was initiated.
  const patientId = (form.get("patientId") as string | null) ?? qs.get("patientId") ?? "";
  // Twilio always sends CallSid — use it to record which call this was.
  const callSid   = (form.get("CallSid")   as string | null) ?? "";

  const base = process.env.TWILIO_WEBHOOK_BASE_URL!.replace(/\/$/, "");

  // Forward patientId + callSid to /api/gather so it can write to Supabase.
  const gatherAction = new URL(`${base}/api/gather`);
  if (patientId) gatherAction.searchParams.set("patientId", patientId);
  if (callSid)   gatherAction.searchParams.set("callSid",   callSid);

  const twiml = new twilio.twiml.VoiceResponse();

  const gather = twiml.gather({
    numDigits: 1,
    action: gatherAction.toString(),
    method: "POST",
    timeout: 8,
  });

  gather.say(
    { voice: "Polly.Aditi", language: "en-IN" },
    "Hello. This is a medicine check-in call from Raksha. " +
      "Did you take your medicine today? " +
      "Press 1 for yes. Press 2 for no. Press 3 to hear this again."
  );

  // No self-redirect — say goodbye if no input received.
  twiml.say(
    { voice: "Polly.Aditi", language: "en-IN" },
    "We did not receive a response. Goodbye. Take care."
  );
  twiml.hangup();

  return new NextResponse(twiml.toString(), {
    headers: { "Content-Type": "text/xml; charset=utf-8" },
  });
}
