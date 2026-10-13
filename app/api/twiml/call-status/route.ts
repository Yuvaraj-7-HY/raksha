// app/api/twiml/call-status/route.ts
// Handles Twilio status callbacks for medication check calls

import { NextRequest, NextResponse } from "next/server";
import {
  getMedicationCheckById,
  getMedicationCheckByCallSid,
  updateMedicationCheckByCallSidOrId,
} from "@/lib/medication-checks";
import { scheduleCaregiverAlert } from "@/lib/familyAlert";

export async function POST(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const checkId = searchParams.get("checkId") || "";
    const patientId = searchParams.get("patientId") || "";

    let callStatus: string | null = null;
    let callDuration: string | null = null;
    let callSid: string | null = null;

    try {
      const formData = await req.formData();
      callStatus = (formData.get("CallStatus") as string) || null;
      callDuration = (formData.get("CallDuration") as string) || null;
      callSid = (formData.get("CallSid") as string) || null;
    } catch {
      // Body parsing fallback
    }

    if (!callStatus) callStatus = searchParams.get("CallStatus");
    if (!callSid) callSid = searchParams.get("CallSid");

    console.log("[twiml/call-status] Status callback received:", {
      checkId,
      patientId,
      callSid,
      callStatus,
      callDuration,
    });

    const targetId = checkId || callSid || "";

    if (targetId && callStatus) {
      let existing = checkId ? getMedicationCheckById(checkId) : undefined;
      if (!existing && callSid) {
        existing = getMedicationCheckByCallSid(callSid);
      }

      // If status is terminal and response is still pending
      if (existing && (existing.response === "Pending" || existing.response === "pending")) {
        if (["no-answer", "busy", "failed", "canceled"].includes(callStatus)) {
          console.log(`[twiml/call-status] Marking call ${existing.id} as No Response due to status: ${callStatus}`);
          updateMedicationCheckByCallSidOrId(existing.id, {
            status: "no_response",
            response: "No Response",
            notes: `Call ended without patient answer (${callStatus})`,
          });

          scheduleCaregiverAlert({
            patientId: existing.patientId || patientId,
            patientName: existing.patientName,
            reason: "unreachable",
            customMessage: `Raksha Alert: Medication check call to ${existing.patientName || "patient"} was not picked (${callStatus}). Please check on them.`,
            delayMs: 60_000,
          });
        }
      }
    }

    return new NextResponse("<Response/>", {
      status: 200,
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
        "ngrok-skip-browser-warning": "true",
      },
    });
  } catch (err) {
    console.error("[twiml/call-status] Error processing callback:", err);
    return new NextResponse("<Response/>", {
      status: 200,
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
        "ngrok-skip-browser-warning": "true",
      },
    });
  }
}

export async function GET() {
  return new NextResponse("<Response/>", {
    status: 200,
    headers: {
      "Content-Type": "text/xml; charset=utf-8",
      "ngrok-skip-browser-warning": "true",
    },
  });
}
