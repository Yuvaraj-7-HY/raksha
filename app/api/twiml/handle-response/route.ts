// app/api/twiml/handle-response/route.ts
// Receives patient keypad DTMF input (Digits 1 or 2) from Twilio Gather and saves response

import { NextRequest, NextResponse } from "next/server";
import {
  updateMedicationCheckByCallSidOrId,
  getMedicationCheckById,
  getMedicationCheckByCallSid,
  getLatestMedicationCheck,
  upsertMedicationCheck,
} from "@/lib/medication-checks";
import { scheduleCaregiverAlert } from "@/lib/familyAlert";
import { appendDoseEvent } from "@/lib/dose-events";

function getPublicBaseUrl(): string {
  const envUrl =
    process.env.TWILIO_WEBHOOK_BASE_URL ||
    process.env.NEXT_PUBLIC_BASE_URL ||
    process.env.PUBLIC_BASE_URL ||
    "https://uncoiled-dominion-dad.ngrok-free.dev";

  let url = envUrl.trim();
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    url = `https://${url}`;
  }
  return url.replace(/\/$/, "");
}

async function handleResponse(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const checkId = searchParams.get("checkId") || "";
  const patientId = searchParams.get("patientId") || "";
  const isNoInput = searchParams.get("noInput") === "1" || searchParams.get("timeout") === "1";
  const isRetry = searchParams.get("retry") === "1";

  const isFollowUp = searchParams.get("isFollowUp") === "1" || (checkId && checkId.startsWith("mc_retry_"));

  let digits: string | null = null;
  let callSid: string | null = null;

  // Twilio sends webhook body as application/x-www-form-urlencoded
  try {
    const formData = await req.formData();
    digits = (formData.get("Digits") as string) || null;
    callSid = (formData.get("CallSid") as string) || null;
  } catch (err) {
    // If formData parsing fails or is empty, fallback to searchParams
    console.warn("[twiml/handle-response] Note: could not parse formData, falling back to params:", err);
  }

  // Fallbacks if not present in formData body
  if (!digits) {
    digits = searchParams.get("Digits");
  }
  if (!callSid) {
    callSid = searchParams.get("CallSid");
  }

  console.log("[twiml/handle-response] Received:", {
    digits,
    callSid,
    checkId,
    patientId,
    isNoInput,
    isRetry,
    isFollowUp,
  });

  const targetIdentifier = checkId || callSid || "";

  let twiml = "";

  if (digits === "1") {
    // ── PRESS 1: TAKEN ──────────────────────────────────────────────────────
    console.log(`[twiml/handle-response] Patient pressed 1 -> Taken (targetIdentifier: ${targetIdentifier}, callSid: ${callSid})`);

    const updatedCheck = upsertMedicationCheck(targetIdentifier, patientId, {
      status: "completed",
      response: "Taken",
      digits: "1",
      callSid: callSid || undefined,
      notes: "Patient pressed 1 (Taken)",
    });

    // ✨ Emit a dose-taken event so the Today page can auto-mark this dose as taken
    const doseId = updatedCheck?.doseId;
    if (doseId) {
      appendDoseEvent({
        doseId,
        patientId,
        eventType: "taken",
        medicineName: updatedCheck?.medicineName,
        source: "ivr_press_1",
      });
      console.log(`[twiml/handle-response] Emitted dose-taken event for doseId=${doseId}`);
    } else {
      console.warn(`[twiml/handle-response] Press 1 received but no doseId on record (checkId=${targetIdentifier})`);
    }

    twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Aditi" language="en-IN">
    Thank you! Your response that you have taken your medicine has been recorded. Goodbye.
  </Say>
  <Hangup/>
</Response>`;
  } else if (digits === "2") {
    // ── PRESS 2: NOT TAKEN ──────────────────────────────────────────────────
    if (isFollowUp) {
      console.log(`[twiml/handle-response] Patient pressed 2 for the second time -> Alerting caregiver in 1 min (targetIdentifier: ${targetIdentifier})`);

      upsertMedicationCheck(targetIdentifier, patientId, {
        status: "completed",
        response: "Not Taken",
        digits: "2",
        callSid: callSid || undefined,
        notes: "Patient pressed 2 for the second time (Not Taken). Alerting caregiver in 1 minute.",
      });

      twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Aditi" language="en-IN">
    Thank you for letting us know. We have recorded that you have not taken your medicine. Your caregiver will be notified. Goodbye.
  </Say>
  <Hangup/>
</Response>`;

      // Alert caregiver for their assigned number in 1 minute
      scheduleCaregiverAlert({
        patientId,
        reason: "missed_dose_reported",
        customMessage: "Raksha Alert: Patient confirmed for the second time that they have not taken their medicine today. Please check on them.",
        delayMs: 60_000,
      });
    } else {
      console.log(`[twiml/handle-response] Patient pressed 2 (first time) -> Scheduling follow-up call in 1 min (targetIdentifier: ${targetIdentifier})`);

      upsertMedicationCheck(targetIdentifier, patientId, {
        status: "completed",
        response: "Not Taken",
        digits: "2",
        callSid: callSid || undefined,
        notes: "Patient pressed 2 (Not Taken). Follow-up call scheduled in 1 minute.",
      });

      twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Aditi" language="en-IN">
    Thank you for letting us know. Please take your medicine as advised. We will call you again in one minute to check if you have taken your medicine. Goodbye.
  </Say>
  <Hangup/>
</Response>`;

      // Schedule outbound follow-up call in 1 minute (60 seconds)
      scheduleOneMinuteFollowUpCall(patientId, checkId, callSid);
    }
  } else if (!digits || isNoInput) {
    // ── NO INPUT / TIMEOUT ──────────────────────────────────────────────────
    console.log(`[twiml/handle-response] No keypad input received -> No Response (targetIdentifier: ${targetIdentifier}). Scheduling caregiver alert in 1 min.`);

    upsertMedicationCheck(targetIdentifier, patientId, {
      status: "no_response",
      response: "No Response",
      digits: undefined,
      callSid: callSid || undefined,
      notes: "No input received. Call timed out without keypad selection. Caregiver will be alerted in 1 minute.",
    });

    twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Aditi" language="en-IN">
    We did not receive any input. Goodbye.
  </Say>
  <Hangup/>
</Response>`;

    // Alert caregiver in 1 minute
    scheduleCaregiverAlert({
      patientId,
      reason: "unreachable",
      customMessage: "Raksha Alert: Medication check call timed out with no response from the patient. Please check on them.",
      delayMs: 60_000,
    });
  } else {
    // ── ANY OTHER KEY (INVALID DIGIT) ───────────────────────────────────────
    console.log(`[twiml/handle-response] Invalid key pressed: "${digits}" (isRetry: ${isRetry})`);

    if (!isRetry) {
      // Repeat the question ONCE
      const baseUrl = getPublicBaseUrl();
      const queryParams = `checkId=${encodeURIComponent(checkId)}&amp;patientId=${encodeURIComponent(patientId)}&amp;retry=1`;
      const retryActionUrl = `${baseUrl}/api/twiml/handle-response?${queryParams}`;

      twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather input="dtmf" numDigits="1" timeout="8" action="${retryActionUrl}" method="POST">
    <Say voice="Polly.Aditi" language="en-IN">
      That was not an option. Let us try once more. Have you taken your medicine today? If yes, press 1. If no, press 2.
    </Say>
  </Gather>
  <Say voice="Polly.Aditi" language="en-IN">
    We did not receive any input. Goodbye.
  </Say>
  <Hangup/>
</Response>`;
    } else {
      // Already retried once, still invalid -> mark as No Response and hang up
      upsertMedicationCheck(targetIdentifier, patientId, {
        status: "no_response",
        response: "No Response",
        digits: digits,
        callSid: callSid || undefined,
        notes: `Invalid key entered twice (${digits}). Call ended.`,
      });

      twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Aditi" language="en-IN">
    We did not receive a valid input. Goodbye.
  </Say>
  <Hangup/>
</Response>`;
    }
  }

  console.log(`[twiml/handle-response] Returning TwiML:\n${twiml}`);

  return new NextResponse(twiml, {
    status: 200,
    headers: {
      "Content-Type": "text/xml; charset=utf-8",
      "Cache-Control": "no-cache, no-store, must-revalidate",
      "ngrok-skip-browser-warning": "true",
    },
  });
}

export async function POST(req: NextRequest) {
  return handleResponse(req);
}

export async function GET(req: NextRequest) {
  return handleResponse(req);
}

function scheduleOneMinuteFollowUpCall(patientId: string, checkId: string, callSid: string | null) {
  console.log(`[twiml/handle-response] Scheduled 1-minute follow-up call for patient=${patientId}`);
  setTimeout(async () => {
    try {
      console.log(`[twiml/handle-response] 1 minute elapsed. Initiating follow-up medication check call for patient=${patientId}...`);

      const accountSid = process.env.TWILIO_ACCOUNT_SID;
      const authToken = process.env.TWILIO_AUTH_TOKEN;
      const fromNumber = process.env.TWILIO_PHONE_NUMBER || process.env.TWILIO_FROM_NUMBER;

      if (!accountSid || !authToken || !fromNumber) {
        console.error("[twiml/handle-response] Twilio credentials missing for scheduled call.");
        return;
      }

      // Determine patient phone and name
      let patientPhone = "";
      let patientName = "Patient";

      const check = (checkId ? getMedicationCheckById(checkId) : null) || (callSid ? getMedicationCheckByCallSid(callSid) : null);
      if (check?.phone) {
        patientPhone = check.phone;
        patientName = check.patientName || "Patient";
      } else {
        try {
          const { findPatientById } = await import("@/lib/supabaseServer");
          const p = await findPatientById(patientId);
          if (p?.phone) {
            patientPhone = p.phone;
            patientName = p.name;
          }
        } catch {}
      }

      if (!patientPhone) {
        patientPhone = process.env.PATIENT_PHONE_NUMBER || "+917406842246";
      }

      const baseUrl = getPublicBaseUrl();
      const newCheckId = `mc_retry_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const nowIso = new Date().toISOString();

      upsertMedicationCheck(newCheckId, patientId, {
        status: "calling",
        response: "Pending",
        notes: "1-minute follow-up call initiated to ask if medicine is taken.",
        patientName,
      });

      const twilioModule = (await import("twilio")).default;
      const client = twilioModule(accountSid, authToken);

      const twimlUrl = `${baseUrl}/api/twiml/medication-check?checkId=${encodeURIComponent(newCheckId)}&patientId=${encodeURIComponent(patientId)}&isFollowUp=1`;
      const statusUrl = `${baseUrl}/api/twiml/call-status?checkId=${encodeURIComponent(newCheckId)}&patientId=${encodeURIComponent(patientId)}`;

      const newCall = await client.calls.create({
        to: patientPhone,
        from: fromNumber,
        url: twimlUrl,
        statusCallback: statusUrl,
        statusCallbackEvent: ["initiated", "ringing", "answered", "completed"],
        timeout: Number(process.env.RING_TIMEOUT_SECONDS) || 30,
      });

      console.log(`[twiml/handle-response] 1-minute follow-up call placed successfully! CallSid: ${newCall.sid}`);
      upsertMedicationCheck(newCheckId, patientId, {
        callSid: newCall.sid,
      });
    } catch (err) {
      console.error("[twiml/handle-response] Error placing 1-minute follow-up call:", err);
    }
  }, 60_000);
}

