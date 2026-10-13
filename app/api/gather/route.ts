// app/api/gather/route.ts
// Handles digit press from the DTMF IVR.
// Inserts ONE immutable call_attempts record and updates patient status.

import { NextRequest, NextResponse } from "next/server";
import twilio from "twilio";
import {
  insertCallAttempt,
  updatePatientStatus,
  type CallOutcome,
  type ContactStatus,
} from "@/lib/supabaseServer";

// Maps digit → valid outcome (matches DB CHECK constraint).
const DIGIT_TO_OUTCOME: Record<string, CallOutcome> = {
  "1": "yes",
  "2": "no",
};

export async function POST(req: NextRequest) {
  const qs   = req.nextUrl.searchParams;
  const form = await req.formData();

  const digits    = (form.get("Digits")    as string | null) ?? "";
  const patientId = (form.get("patientId") as string | null) ?? qs.get("patientId") ?? "";
  const callSid   = (form.get("callSid")   as string | null) ?? qs.get("callSid")   ?? "";

  console.log("[gather]", { digits, patientId, callSid });

  const twiml = new twilio.twiml.VoiceResponse();

  // ── 1. Respond to the patient ──────────────────────────────────────────────
  if (digits === "1") {
    twiml.say(
      { voice: "Polly.Aditi", language: "en-IN" },
      "That is wonderful! Thank you for taking your medicine. Take care. Goodbye."
    );
  } else if (digits === "2") {
    twiml.say(
      { voice: "Polly.Aditi", language: "en-IN" },
      "Thank you for letting us know. Please try to take your medicine soon. " +
        "Your family has been notified. Take care. Goodbye."
    );
  } else if (digits === "3") {
    // Repeat — redirect back to /api/voice/simple.
    const base      = process.env.TWILIO_WEBHOOK_BASE_URL!.replace(/\/$/, "");
    const repeatUrl = new URL(`${base}/api/voice/simple`);
    if (patientId) repeatUrl.searchParams.set("patientId", patientId);
    twiml.redirect({ method: "POST" }, repeatUrl.toString());
  } else {
    twiml.say(
      { voice: "Polly.Aditi", language: "en-IN" },
      "Sorry, we did not understand your response. Goodbye."
    );
  }

  if (digits !== "3") twiml.hangup();

  // ── 2. Write to Supabase (only for definitive answers: 1 or 2) ────────────
  const outcome = DIGIT_TO_OUTCOME[digits]; // undefined for 3 / unknown

  if (outcome && patientId) {
    const status = outcome as ContactStatus; // 'yes' | 'no' both valid for both types

    insertCallAttempt({
      patientId,
      twilioCallSid: callSid || null,
      outcome,
      rawDigits: digits,
    }).catch((e) => console.error("[gather] insertCallAttempt failed:", e));

    updatePatientStatus(patientId, status)
      .catch((e) => console.error("[gather] updatePatientStatus failed:", e));
  }

  return new NextResponse(twiml.toString(), {
    headers: { "Content-Type": "text/xml; charset=utf-8" },
  });
}
