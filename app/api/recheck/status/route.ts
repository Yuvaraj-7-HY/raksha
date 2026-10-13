// app/api/recheck/status/route.ts
// Twilio status callback for re-check calls.
// Handles: no-answer | busy | failed | completed
//
// "completed" means the call connected; /api/gather already wrote the outcome.
// "no-answer" | "busy" | "failed" means nobody answered → escalate to family.

import { NextRequest, NextResponse } from "next/server";
import {
  insertCallAttempt,
  updatePatientStatus,
  findPatientById,
  callAttemptExistsBySid,
} from "@/lib/supabaseServer";
import { sendFamilyAlert, scheduleCaregiverAlert } from "@/lib/familyAlert";

const TERMINAL_NO_ANSWER = new Set(["no-answer", "busy", "failed"]);

export async function POST(req: NextRequest) {
  const qs   = req.nextUrl.searchParams;
  const raw  = await req.text();
  const form = new URLSearchParams(raw);

  const callStatus = form.get("CallStatus") ?? "";
  const callSid    = form.get("CallSid")    ?? "";
  const patientId  = form.get("patientId") ?? qs.get("patientId") ?? "";
  const isRecheck  = (form.get("is_recheck") ?? qs.get("is_recheck")) === "1";

  console.log("[recheck/status]", { callStatus, callSid, patientId, isRecheck });

  // Only act on terminal failed states; "completed" was handled by /api/gather
  if (!TERMINAL_NO_ANSWER.has(callStatus) || !patientId) {
    return new NextResponse("OK", { status: 200 });
  }

  // Idempotency
  if (callSid) {
    try {
      const exists = await callAttemptExistsBySid(callSid);
      if (exists) {
        console.log(`[recheck/status] Already handled CallSid ${callSid}`);
        return new NextResponse("OK", { status: 200 });
      }
    } catch (e) {
      console.error("[recheck/status] idempotency check failed:", e);
    }
  }

  // Map Twilio callStatus → our outcome type
  const outcome =
    callStatus === "no-answer" ? "no-answer"
    : callStatus === "busy"   ? "no-answer"
    : "failed";

  try {
    console.log(
      `[recheck/status] Re-check call ${callStatus} for patient=${patientId} — escalating.`
    );

    await insertCallAttempt({
      patientId,
      twilioCallSid: callSid || null,
      outcome,
      isRecheck:     true,
    });

    const patient = await findPatientById(patientId);
    scheduleCaregiverAlert({
      patientId,
      patientName:   patient?.name,
      familyPhone:   patient?.family_phone ?? null,
      reason:        "unreachable",
      customMessage: `Raksha Alert: Re-check call to ${patient?.name || "patient"} was not answered (${callStatus}). Please check on them.`,
      delayMs:       60_000,
    });

    await updatePatientStatus(patientId, "no", {
      recheckPending: false,
      recheckDueAt:   null,
    });
  } catch (e) {
    console.error("[recheck/status] handler error:", e);
  }

  return new NextResponse("OK", { status: 200 });
}
