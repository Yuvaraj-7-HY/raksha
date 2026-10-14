// app/api/n8n/turn/route.ts
// Receives speech-to-text transcription from simulated call,
// forwards it to n8n care-turn workflow, and returns the answer.

import { NextRequest, NextResponse } from "next/server";
import { callN8nCareTurn } from "@/lib/n8n";
import { db } from "@/lib/supabaseServer";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const {
      callId = `sim_${Date.now()}`,
      callType = "medication_check",
      context = "Medication adherence check for elderly patient",
      history = [],
      userText = "",
      turnIndex = 0,
      patientId,
      patientName,
    } = body;

    console.log(`[api/n8n/turn] Received spoken transcription: "${userText}" (turnIndex: ${turnIndex})`);

    // 1. Call n8n care-turn workflow
    const n8nResult = await callN8nCareTurn({
      callId,
      callType,
      context,
      history,
      userText: userText || null,
      turnIndex,
      patient_id: patientId,
      patient_name: patientName,
    });

    console.log(`[api/n8n/turn] Answer from n8n: "${n8nResult.reply}" (end_call: ${n8nResult.end_call})`);

    // 2. If the patient confirmed taken/not taken in their spoken answer, update Supabase
    if (patientId && userText) {
      const lower = userText.toLowerCase();
      try {
        const supabase = db.get();
        if (lower.includes("yes") || lower.includes("took") || lower.includes("taken") || lower.includes("done")) {
          await supabase
            .from("patients")
            .update({ status: "yes", recheck_pending: false })
            .eq("id", patientId);

          await supabase.from("call_attempts").insert({
            patient_id: patientId,
            attempt_number: turnIndex + 1,
            outcome: "yes",
            raw_digits: "speech_yes",
            twilio_call_sid: `speech_${callId}`,
          });
        } else if (lower.includes("no") || lower.includes("not yet") || lower.includes("haven't")) {
          await supabase
            .from("patients")
            .update({ status: "no" })
            .eq("id", patientId);

          await supabase.from("call_attempts").insert({
            patient_id: patientId,
            attempt_number: turnIndex + 1,
            outcome: "no",
            raw_digits: "speech_no",
            twilio_call_sid: `speech_${callId}`,
          });
        }
      } catch (dbErr) {
        console.warn("[api/n8n/turn] Supabase note:", dbErr);
      }
    }

    return NextResponse.json({
      ok: true,
      reply: n8nResult.reply,
      end_call: n8nResult.end_call,
      emergency: n8nResult.emergency,
      source: "n8n",
    });
  } catch (err: any) {
    console.error("[api/n8n/turn] Error:", err);
    return NextResponse.json(
      {
        ok: false,
        reply: "Thank you for letting me know. Please take your medicine and stay healthy.",
        end_call: true,
        emergency: false,
      },
      { status: 500 }
    );
  }
}
