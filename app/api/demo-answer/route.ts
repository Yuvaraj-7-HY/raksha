// app/api/demo-answer/route.ts
// POST: Forwards simulated answer to /api/gather exactly as Twilio would

import { NextRequest, NextResponse } from "next/server";
import { endCall, readRingState } from "@/lib/ringState";
import { db } from "@/lib/supabaseServer";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { attempt_id, digit } = body;

    if (!attempt_id || !digit) {
      return NextResponse.json({ error: "Missing required fields: attempt_id, digit" }, { status: 400 });
    }

    if (digit !== "1" && digit !== "2") {
      return NextResponse.json({ error: "Invalid digit: must be '1' (Yes) or '2' (No)" }, { status: 400 });
    }

    // 1. Check in-memory ring state and database for attempt details
    let isRecheck = false;
    const currentRing = readRingState();
    if (currentRing.context === "recheck_call" || (currentRing.attempt && currentRing.attempt > 1)) {
      isRecheck = true;
    }

    const supabase = db.get();
    let patientId = "";

    try {
      const { data: attempt } = await supabase
        .from("call_attempts")
        .select("id, patient_id, is_recheck")
        .eq("id", attempt_id)
        .single();

      if (attempt) {
        patientId = attempt.patient_id;
        if (attempt.is_recheck) isRecheck = true;
      }
    } catch {
      // In simulated mock fallback, try finding patient
    }

    if (!patientId) {
      // If attemptId is formatted as patientId or lookup from active
      if (attempt_id.includes("-") && attempt_id.length === 36) {
        patientId = attempt_id;
      } else {
        const { data: p } = await supabase.from("patients").select("id").eq("is_active", true).limit(1).single();
        patientId = p?.id || "";
      }
    }

    // 2. Make sure the attempt leaves the ringing state
    endCall(attempt_id);
    try {
      await supabase
        .from("call_attempts")
        .update({ status: "completed" })
        .eq("id", attempt_id);
    } catch {
      // If status column doesn't exist yet
    }

    // 3. Forward to the existing /api/gather endpoint exactly as Twilio would
    const appUrl = (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
    const gatherUrl = new URL(`${appUrl}/api/gather`);
    gatherUrl.searchParams.set("callSid", attempt_id);
    if (patientId) gatherUrl.searchParams.set("patientId", patientId);
    if (isRecheck) gatherUrl.searchParams.set("is_recheck", "1");

    // Form-encoded body matching Twilio webhook
    const formData = new URLSearchParams();
    formData.set("Digits", digit);
    formData.set("CallSid", attempt_id);
    if (patientId) formData.set("patientId", patientId);

    console.log(`[demo-answer] Forwarding simulated answer digit=${digit} for attempt=${attempt_id} to ${gatherUrl.toString()}...`);

    const gatherResponse = await fetch(gatherUrl.toString(), {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        // Signature bypass header for mock provider
        "x-mock-demo": "true",
      },
      body: formData.toString(),
    });

    const responseText = await gatherResponse.text();

    return NextResponse.json({
      ok: true,
      digit,
      attempt_id,
      patient_id: patientId,
      gather_status: gatherResponse.status,
      twiml: responseText,
    });
  } catch (err: any) {
    console.error("[demo-answer] Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
