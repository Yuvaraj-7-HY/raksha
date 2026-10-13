// app/api/gather/route.ts
// Handles DTMF keypress from the IVR (/api/voice/simple).
//
// Digits:
//   1 → patient took medicine (unchanged)
//   2 → patient did NOT take medicine — schedule re-check, reply politely
//   3 → repeat prompt (redirect to /api/voice/simple — unchanged)
//   * → unknown key, say "sorry" and hang up (unchanged)
//
// Re-check context:
//   If the query string contains is_recheck=1, this is the follow-up call.
//   • Digit 1  → resolved, no family alert
//   • Digit 2 / no answer / unclear → escalate (send family SMS/Telegram)
//
// Idempotency:
//   Twilio may POST the same webhook twice. We check twilio_call_sid uniqueness
//   before writing. If a row already exists for that SID we still return valid
//   TwiML so Twilio is satisfied, but we skip DB writes.

import { NextRequest, NextResponse } from "next/server";
import twilio from "twilio";
import {
  insertCallAttempt,
  updatePatientStatus,
  callAttemptExistsBySid,
  findPatientById,
  clearRecheckPending,
  type CallOutcome,
  type ContactStatus,
} from "@/lib/supabaseServer";
import { sendFamilyAlert, scheduleCaregiverAlert } from "@/lib/familyAlert";
import { notifyPatientMedicationResponse } from "@/lib/telegram";

// Read recheck delay from env (default 1 min)
const RECHECK_DELAY_MINUTES = Number(
  process.env.RECHECK_DELAY_MINUTES ?? 1
);

// Maps digit → DB outcome for definitive answers
const DIGIT_TO_OUTCOME: Record<string, CallOutcome> = {
  "1": "yes",
  "2": "no",
};

// ── Twilio signature validation ────────────────────────────────────────────────
// Validates X-Twilio-Signature using the auth token + webhook URL.
// In development (TWILIO_VALIDATE=false) the check is skipped.
function validateTwilioSignature(req: NextRequest, body: URLSearchParams): boolean {
  if (process.env.TWILIO_VALIDATE === "false") return true;

  const authToken = process.env.TWILIO_AUTH_TOKEN!;
  const webhookUrl = `${process.env.TWILIO_WEBHOOK_BASE_URL}/api/gather`;
  const signature  = req.headers.get("x-twilio-signature") ?? "";

  return twilio.validateRequest(
    authToken,
    signature,
    webhookUrl,
    Object.fromEntries(body.entries())
  );
}

// ── Main handler ───────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const qs   = req.nextUrl.searchParams;
  const raw  = await req.text();
  const form = new URLSearchParams(raw);

  // ── Parse incoming fields ──────────────────────────────────────────────────
  const digits    = form.get("Digits")    ?? "";
  const callSid   = form.get("CallSid")   ?? qs.get("callSid")   ?? "";
  const patientId = form.get("patientId") ?? qs.get("patientId") ?? "";
  const isRecheck = qs.get("is_recheck") === "1";

  console.log("[gather]", { digits, patientId, callSid, isRecheck });

  // ── Signature validation ───────────────────────────────────────────────────
  if (!validateTwilioSignature(req, form)) {
    console.warn("[gather] Invalid Twilio signature — rejected.");
    return new NextResponse("Forbidden", { status: 403 });
  }

  // ── Idempotency: bail if we already handled this exact Twilio call ─────────
  let alreadyHandled = false;
  if (callSid) {
    try {
      alreadyHandled = await callAttemptExistsBySid(callSid);
    } catch (e) {
      console.error("[gather] idempotency check failed:", e);
    }
  }
  if (alreadyHandled) {
    console.log(`[gather] Duplicate webhook for CallSid ${callSid} — returning cached TwiML.`);
    // Return a valid hangup TwiML so Twilio doesn't retry endlessly.
    const t = new twilio.twiml.VoiceResponse();
    t.say({ voice: "Polly.Aditi", language: "en-IN" }, "Goodbye.");
    t.hangup();
    return new NextResponse(t.toString(), {
      headers: { "Content-Type": "text/xml; charset=utf-8" },
    });
  }

  // ── Build TwiML response ───────────────────────────────────────────────────
  const twiml = new twilio.twiml.VoiceResponse();

  if (digits === "1") {
    // ── Patient says YES ─────────────────────────────────────────────────────
    twiml.say(
      { voice: "Polly.Aditi", language: "en-IN" },
      "That is wonderful! Thank you for taking your medicine. Take care. Goodbye."
    );
    twiml.hangup();

    // Write DB asynchronously so TwiML returns instantly
    void persistYes({ patientId, callSid, isRecheck });

  } else if (digits === "2") {
    // ── Patient says NO — safe, non-medical message ──────────────────────────
    twiml.say(
      { voice: "Polly.Aditi", language: "en-IN" },
      "Thank you for telling us. " +
      "Please take your medicine as your doctor has advised. " +
      "We will call you again in one minute to check if you have taken your medicine."
    );
    twiml.hangup();

    // Async: log attempt, set recheck (or escalate if re-check)
    void persistNo({ patientId, callSid, isRecheck });

  } else if (digits === "3") {
    // ── Repeat the prompt ────────────────────────────────────────────────────
    const base      = process.env.TWILIO_WEBHOOK_BASE_URL!.replace(/\/$/, "");
    const repeatUrl = new URL(`${base}/api/voice/simple`);
    if (patientId) repeatUrl.searchParams.set("patientId", patientId);
    if (isRecheck) repeatUrl.searchParams.set("is_recheck", "1");
    twiml.redirect({ method: "POST" }, repeatUrl.toString());
    // No DB write for digit 3

  } else {
    // ── Unknown input or no response ──────────────────────────────────────────
    twiml.say(
      { voice: "Polly.Aditi", language: "en-IN" },
      "We did not receive a valid response. Goodbye."
    );
    twiml.hangup();

    if (patientId) {
      void persistNoResponse({ patientId, callSid, isRecheck });
    }
  }

  return new NextResponse(twiml.toString(), {
    headers: { "Content-Type": "text/xml; charset=utf-8" },
  });
}

// ── DB side-effects — run after TwiML is already sent ─────────────────────────

async function persistYes(opts: {
  patientId: string;
  callSid:   string;
  isRecheck: boolean;
}) {
  const { patientId, callSid, isRecheck } = opts;
  if (!patientId) return;

  try {
    console.log(`[gather] Writing YES. patient=${patientId} recheck=${isRecheck}`);

    await insertCallAttempt({
      patientId,
      twilioCallSid: callSid || null,
      outcome:       "yes",
      rawDigits:     "1",
      isRecheck,
    });

    // Digit 1 always resolves — clear re-check flag
    await updatePatientStatus(patientId, "yes", {
      recheckPending: false,
      recheckDueAt:   null,
    });

    console.log(`[gather] Patient ${patientId} resolved — medicine taken.`);

    // ── Notify Telegram bot ──
    const patient = await findPatientById(patientId).catch(() => null);
    await notifyPatientMedicationResponse({
      patientName: patient?.name || "Patient",
      patientPhone: patient?.phone || undefined,
      patientId,
      action: "taken",
      rawText: "Pressed 1 (Medicine Taken)",
      channel: "voice_call",
      notes: isRecheck ? "Confirmed during re-check phone call" : "Confirmed during automated phone call",
    });
  } catch (e) {
    console.error("[gather] persistYes failed:", e);
  }
}

async function persistNo(opts: {
  patientId: string;
  callSid:   string;
  isRecheck: boolean;
}) {
  const { patientId, callSid, isRecheck } = opts;
  if (!patientId) return;

  try {
    console.log(`[gather] Writing NO. patient=${patientId} recheck=${isRecheck}`);

    await insertCallAttempt({
      patientId,
      twilioCallSid: callSid || null,
      outcome:       "no",
      rawDigits:     "2",
      isRecheck,
    });

    const patient = await findPatientById(patientId).catch(() => null);
    await notifyPatientMedicationResponse({
      patientName: patient?.name || "Patient",
      patientPhone: patient?.phone || undefined,
      patientId,
      action: "not_taken",
      rawText: "Pressed 2 (Not Taken)",
      channel: "voice_call",
      notes: isRecheck
        ? "Confirmed second time: Medicine not taken. Caregiver alert scheduled."
        : "Patient indicated medicine not taken yet. Auto re-check scheduled in 1 min.",
    });

    if (!isRecheck) {
      // ── First-time "no": schedule re-check, do NOT send family SMS yet ──────
      const recheckDueAt = new Date(
        Date.now() + RECHECK_DELAY_MINUTES * 60 * 1000
      ).toISOString();

      await updatePatientStatus(patientId, "no", {
        recheckPending: true,
        recheckDueAt,
      });

      console.log(
        `[gather] Re-check scheduled for patient=${patientId} at ${recheckDueAt}` +
        ` (${RECHECK_DELAY_MINUTES} min from now)`
      );

      // Auto-initiate re-check call after delay (1 minute)
      scheduleAutoRecheckCall(patientId, RECHECK_DELAY_MINUTES * 60 * 1000);
    } else {
      // ── Re-check also "no" (second time) → escalate to caregiver in 1 minute ─
      console.log(`[gather] Re-check digit 2 (second "no") → scheduling caregiver alert in 1 min for patient=${patientId}`);
      await updatePatientStatus(patientId, "no", {
        recheckPending: false,
        recheckDueAt:   null,
      });

      scheduleCaregiverAlert({
        patientId,
        reason: "missed_dose_reported",
        customMessage: "Raksha Alert: The patient confirmed for the second time that they have not taken their medicine today. Please check in with them.",
        delayMs: 60_000,
      });
    }
  } catch (e) {
    console.error("[gather] persistNo failed:", e);
  }
}

async function persistNoResponse(opts: {
  patientId: string;
  callSid:   string;
  isRecheck: boolean;
}) {
  const { patientId, callSid, isRecheck } = opts;
  if (!patientId) return;

  try {
    console.log(`[gather] No response / unclear input for patient=${patientId}. Scheduling caregiver alert in 1 minute.`);
    await insertCallAttempt({
      patientId,
      twilioCallSid: callSid || null,
      outcome:       "unclear",
      rawDigits:     undefined,
      isRecheck,
    });

    await updatePatientStatus(patientId, "no-answer", {
      recheckPending: false,
      recheckDueAt:   null,
    });

    const patient = await findPatientById(patientId).catch(() => null);
    await notifyPatientMedicationResponse({
      patientName: patient?.name || "Patient",
      patientPhone: patient?.phone || undefined,
      patientId,
      action: "other",
      rawText: "No response on call",
      channel: "voice_call",
      notes: "Patient did not enter keypad response. Caregiver alert scheduled.",
    });

    scheduleCaregiverAlert({
      patientId,
      reason: "unreachable",
      customMessage: "Raksha Alert: No response was received on the medication check call. Please check on them.",
      delayMs: 60_000,
    });
  } catch (e) {
    console.error("[gather] persistNoResponse failed:", e);
  }
}

/** Automatically initiates a recheck outbound call after the given delay */
function scheduleAutoRecheckCall(patientId: string, delayMs: number) {
  console.log(`[gather] Timer started: will auto-initiate re-check call for patient=${patientId} in ${delayMs / 1000}s`);
  setTimeout(async () => {
    try {
      console.log(`[gather] ${delayMs / 1000}s elapsed. Auto-initiating re-check call for patient=${patientId}...`);
      const patient = await findPatientById(patientId);
      if (!patient || !patient.phone || !patient.is_active) {
        console.log(`[gather] Patient ${patientId} inactive or missing phone, skipping auto-recheck.`);
        return;
      }

      // If patient is no longer pending recheck (e.g. marked resolved), skip
      if (!patient.recheck_pending) {
        console.log(`[gather] Patient ${patientId} recheck is no longer pending, skipping auto-call.`);
        return;
      }

      await clearRecheckPending(patientId);

      const accountSid = process.env.TWILIO_ACCOUNT_SID;
      const authToken  = process.env.TWILIO_AUTH_TOKEN;
      const fromNumber = process.env.TWILIO_PHONE_NUMBER || process.env.TWILIO_FROM_NUMBER;
      const baseUrl    = (process.env.TWILIO_WEBHOOK_BASE_URL ?? process.env.PUBLIC_BASE_URL ?? "").replace(/\/$/, "");

      if (!accountSid || !authToken || !fromNumber || !baseUrl) {
        console.warn("[gather] Missing Twilio credentials or base URL for auto-recheck call.");
        return;
      }

      const client = twilio(accountSid, authToken);
      const voiceUrl = new URL(`${baseUrl}/api/voice/simple`);
      voiceUrl.searchParams.set("patientId", patientId);
      voiceUrl.searchParams.set("is_recheck", "1");

      const statusUrl = new URL(`${baseUrl}/api/recheck/status`);
      statusUrl.searchParams.set("patientId", patientId);
      statusUrl.searchParams.set("is_recheck", "1");

      const call = await client.calls.create({
        to:                   patient.phone,
        from:                 fromNumber,
        url:                  voiceUrl.toString(),
        statusCallback:       statusUrl.toString(),
        statusCallbackMethod: "POST",
        statusCallbackEvent:  ["completed", "busy", "no-answer", "failed"],
        timeout:              Number(process.env.RING_TIMEOUT_SECONDS ?? 30),
      });

      console.log(`[gather] Auto-recheck call placed! CallSid: ${call.sid}`);
    } catch (err) {
      console.error("[gather] Error placing auto-recheck call:", err);
    }
  }, delayMs);
}

