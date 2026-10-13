// app/api/call/route.ts
// Triggers a Twilio Studio Flow execution (outbound call).
// The Studio Flow owns the IVR logic — we just start it here.
// call_attempts is written by /api/gather or /api/voice/status once the
// outcome is known.

import { NextRequest, NextResponse } from "next/server";
import twilio from "twilio";
import { findPatientByPhone } from "@/lib/supabaseServer";

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID!,
  process.env.TWILIO_AUTH_TOKEN!
);

const FLOW_SID = process.env.TWILIO_FLOW_SID!;

export async function POST(req: NextRequest) {
  let to: string | undefined;
  try {
    const body = await req.json();
    to = body.to;
  } catch {
    // no body — fall through to default
  }

  to = to?.trim() || process.env.PATIENT_PHONE_NUMBER;
  if (!to) {
    return NextResponse.json(
      { error: "No 'to' number and PATIENT_PHONE_NUMBER not set." },
      { status: 400 }
    );
  }

  if (!FLOW_SID) {
    return NextResponse.json(
      { error: "TWILIO_FLOW_SID is not set in environment." },
      { status: 500 }
    );
  }

  // ── 1. Look up patient in Supabase ─────────────────────────────────────────
  const patient = await findPatientByPhone(to).catch(() => null);
  if (!patient) {
    console.warn("[call] No active patient found for phone:", to);
  }

  // ── 2. Start a Studio Flow Execution (this places the outbound call) ────────
  // The Studio Flow handles the full IVR. Any HTTP Request widgets inside it
  // can POST back to your /api/gather endpoint if you configure them in Studio.
  const execution = await client.studio.v2
    .flows(FLOW_SID)
    .executions.create({
      to,
      from: process.env.TWILIO_PHONE_NUMBER!,
      // Pass patientId as a Flow parameter so Studio widgets can read it.
      parameters: patient ? { patientId: patient.id } : undefined,
    });

  console.log(
    "[call] Studio execution started:",
    execution.sid,
    "→",
    to,
    "patient:",
    patient?.id ?? "unknown"
  );

  return NextResponse.json({
    sid: execution.sid,          // backward-compat with dashboard
    executionSid: execution.sid, // explicit alias
    flowSid: FLOW_SID,
    to,
    patientId: patient?.id ?? null,
  });
}
