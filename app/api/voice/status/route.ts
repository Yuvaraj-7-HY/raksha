// app/api/voice/status/route.ts
// Twilio statusCallback — fires when a call ends.
// Inserts call_attempts for missed/failed calls (gather handles answered ones).
// Also resets in-memory ring state and broadcasts to the dashboard.

export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { endCall, readRingState } from "@/lib/ringState";
import { broadcastRingState } from "@/lib/supabaseBroadcast";
import {
  insertCallAttempt,
  updatePatientStatus,
  type CallOutcome,
  type ContactStatus,
} from "@/lib/supabaseServer";
import { scheduleCaregiverAlert } from "@/lib/familyAlert";

const TERMINAL_STATUSES = new Set([
  "completed", "no-answer", "busy", "failed", "canceled",
]);

// Only write to DB for non-answered terminal states.
// "completed" means gather already wrote the record.
const STATUS_TO_OUTCOME: Record<string, CallOutcome> = {
  "no-answer": "no-answer",
  "busy":      "no-answer", // treat busy as no-answer
  "failed":    "failed",
  "canceled":  "failed",
};

export async function POST(req: NextRequest) {
  const qs   = req.nextUrl.searchParams;
  const form = await req.formData();

  const callStatus = (form.get("CallStatus") as string | null) ?? "";
  const callSid    = (form.get("CallSid")    as string | null) ?? undefined;
  const patientId  = (form.get("patientId")  as string | null) ?? qs.get("patientId") ?? "";

  console.log("[voice/status]", { callSid, callStatus, patientId });

  if (TERMINAL_STATUSES.has(callStatus)) {
    // Reset in-memory ring state and push to dashboard.
    endCall(callSid);
    void broadcastRingState(readRingState());

    // Write to Supabase only for non-answered calls.
    const outcome = STATUS_TO_OUTCOME[callStatus];
    if (outcome && patientId) {
      const status = (callStatus === "no-answer" || callStatus === "busy")
        ? "no-answer" as ContactStatus
        : "no-answer" as ContactStatus; // failed calls also show as no-answer to family

      insertCallAttempt({
        patientId,
        twilioCallSid: callSid ?? null,
        outcome,
      }).catch((e) => console.error("[status] insertCallAttempt failed:", e));

      updatePatientStatus(patientId, status)
        .catch((e) => console.error("[status] updatePatientStatus failed:", e));

      // If call is not picked, message goes to caregiver in 1 minute
      scheduleCaregiverAlert({
        patientId,
        reason: "unreachable",
        customMessage: `Raksha Alert: Automated call to patient was not answered (${callStatus}). Please check on them.`,
        delayMs: 60_000,
      });
    }
  }

  return new NextResponse(null, { status: 204 });
}
