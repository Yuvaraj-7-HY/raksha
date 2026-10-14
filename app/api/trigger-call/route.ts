// app/api/trigger-call/route.ts
// POST: Triggers an automated medication check call (Twilio or Simulated Mock Mode)
// Protected by x-care-secret header == CARE_SHARED_SECRET

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/supabaseServer";
import { provider } from "@/lib/callProvider";
import { CARE_SHARED_SECRET } from "@/lib/config";

export async function POST(req: NextRequest) {
  try {
    // 1. Authorization check: x-care-secret header
    const secret =
      req.headers.get("x-care-secret") ||
      req.headers.get("x-care-shared-secret") ||
      "";

    const expectedSecret = CARE_SHARED_SECRET || process.env.CARE_SHARED_SECRET || "";

    if (!secret || secret !== expectedSecret) {
      return NextResponse.json({ error: "Unauthorized: Invalid or missing x-care-secret" }, { status: 401 });
    }

    // 2. Parse body
    const body = await req.json().catch(() => ({}));
    const { patient_id } = body;

    if (!patient_id) {
      return NextResponse.json({ error: "Missing required field: patient_id" }, { status: 400 });
    }

    // 3. Look up patient in Supabase
    const supabase = db.get();
    const { data: patient, error: patientError } = await supabase
      .from("patients")
      .select("id, name, phone, is_active")
      .eq("id", patient_id)
      .single();

    if (patientError || !patient) {
      return NextResponse.json({ error: "Patient not found" }, { status: 404 });
    }

    if (!patient.phone) {
      return NextResponse.json({ error: "Patient has no phone number configured" }, { status: 400 });
    }

    // 4. Insert call_attempts row (attempt_number 1, outcome 'unclear' / status 'ringing')
    const attemptSid = `mock_att_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const insertPayload: any = {
      patient_id: patient.id,
      attempt_number: 1,
      outcome: "unclear",
      twilio_call_sid: attemptSid,
      is_recheck: false,
    };

    // If status column exists in Supabase, include it
    let attemptId: string = attemptSid;
    try {
      const { data: createdAttempt, error: insertError } = await supabase
        .from("call_attempts")
        .insert(insertPayload)
        .select("id")
        .single();

      if (!insertError && createdAttempt) {
        attemptId = createdAttempt.id;
      }
    } catch (e) {
      console.warn("[trigger-call] Note on call_attempts insert:", e);
    }

    // 5. Place call via provider (mockProvider or twilioProvider)
    await provider.placeCall(patient.phone, attemptId, {
      patientId: patient.id,
      attemptNo: 1,
      isRecheck: false,
    });

    console.log(`[trigger-call] Call triggered for patient=${patient.id} attemptId=${attemptId}`);

    return NextResponse.json({
      ok: true,
      attempt_id: attemptId,
      patient_id: patient.id,
      provider: process.env.CALL_PROVIDER === "mock" ? "mock" : "twilio",
    });
  } catch (err: any) {
    console.error("[trigger-call] Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
