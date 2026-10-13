// app/api/recheck/route.ts
// Re-check scheduler — finds patients with recheck_pending=true and
// recheck_due_at <= now(), then places an outbound Twilio call to each
// using the same /api/voice/simple IVR with is_recheck=1 in the URL.
//
// Authentication: requires the X-Care-Secret header to match CARE_SHARED_SECRET.
// This route is safe to call from a Vercel Cron job and from the dashboard button.
//
// Idempotency: we set recheck_pending=false BEFORE placing the call so a
// patient is never dialled twice even if the scheduler fires in parallel.

import { NextRequest, NextResponse } from "next/server";
import twilio from "twilio";
import {
  getPendingRechecks,
  clearRecheckPending,
  insertCallAttempt,
  updatePatientStatus,
  type Patient,
} from "@/lib/supabaseServer";
import { sendFamilyAlert } from "@/lib/familyAlert";

const CARE_SHARED_SECRET = process.env.CARE_SHARED_SECRET ?? "";

/** Check the shared-secret header. */
function isAuthorized(req: NextRequest): boolean {
  const header = req.headers.get("x-care-secret") ?? "";
  return (
    CARE_SHARED_SECRET.length > 0 && header === CARE_SHARED_SECRET
  );
}

// Allow both GET (Vercel cron calls via URL) and POST (dashboard button)
export async function GET(req: NextRequest) { return run(req); }
export async function POST(req: NextRequest) { return run(req); }

async function run(req: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(req)) {
    console.warn("[recheck] Unauthorized request — missing or wrong x-care-secret.");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  console.log("[recheck] Starting re-check sweep…");

  // ── 1. Find all patients due for a re-check ───────────────────────────────
  let due: Patient[];
  try {
    due = await getPendingRechecks();
  } catch (e) {
    console.error("[recheck] DB query failed:", e);
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }

  console.log(`[recheck] Found ${due.length} patient(s) due.`);

  if (due.length === 0) {
    return NextResponse.json({ dispatched: 0, patients: [] });
  }

  // ── 2. Validate Twilio credentials ────────────────────────────────────────
  const accountSid = process.env.TWILIO_ACCOUNT_SID!;
  const authToken  = process.env.TWILIO_AUTH_TOKEN!;
  const fromNumber = (process.env.TWILIO_PHONE_NUMBER || process.env.TWILIO_FROM_NUMBER)!;
  const baseUrl    = (process.env.TWILIO_WEBHOOK_BASE_URL ?? process.env.PUBLIC_BASE_URL ?? "").replace(/\/$/, "");

  if (!accountSid || !authToken || !fromNumber || !baseUrl) {
    return NextResponse.json(
      { error: "Twilio env vars not configured (TWILIO_ACCOUNT_SID / AUTH_TOKEN / PHONE_NUMBER / WEBHOOK_BASE_URL)" },
      { status: 500 }
    );
  }

  const twilioClient = twilio(accountSid, authToken);
  const results: Array<{ patientId: string; name: string; outcome: string }> = [];

  for (const patient of due) {
    console.log(`[recheck] Processing patient=${patient.id} name="${patient.name}"`);

    // ── 2a. Clear pending flag FIRST (idempotency guard) ────────────────────
    try {
      await clearRecheckPending(patient.id);
    } catch (e) {
      console.error(`[recheck] clearRecheckPending failed for ${patient.id}:`, e);
      results.push({ patientId: patient.id, name: patient.name, outcome: "db_error" });
      continue;
    }

    // ── 2b. Build the IVR webhook URL with is_recheck=1 ─────────────────────
    const voiceUrl = new URL(`${baseUrl}/api/voice/simple`);
    voiceUrl.searchParams.set("patientId",  patient.id);
    voiceUrl.searchParams.set("is_recheck", "1");

    // Gather action URL also carries is_recheck so /api/gather knows the context
    // (voice/simple already forwards all query params through its action URL)

    // Status callback so we can catch no-answer / busy / failed
    const statusUrl = new URL(`${baseUrl}/api/recheck/status`);
    statusUrl.searchParams.set("patientId",  patient.id);
    statusUrl.searchParams.set("is_recheck", "1");

    // ── 2c. Place the outbound call ──────────────────────────────────────────
    try {
      const call = await twilioClient.calls.create({
        to:                   patient.phone,
        from:                 fromNumber,
        url:                  voiceUrl.toString(),
        statusCallback:       statusUrl.toString(),
        statusCallbackMethod: "POST",
        statusCallbackEvent:  ["completed", "busy", "no-answer", "failed"],
        timeout:              Number(process.env.RING_TIMEOUT_SECONDS ?? 30),
      });

      console.log(
        `[recheck] Call placed for patient=${patient.id} sid=${call.sid}`
      );
      results.push({ patientId: patient.id, name: patient.name, outcome: `calling:${call.sid}` });
    } catch (e) {
      console.error(`[recheck] Twilio call failed for patient=${patient.id}:`, e);

      // ── 2d. Call placement failed → escalate immediately ─────────────────
      // The patient could not be reached — treat as missed_dose_reported
      // since we already know they said "no" on the original call.
      await handleRecheckFailed(patient);
      results.push({ patientId: patient.id, name: patient.name, outcome: "call_failed_escalated" });
    }
  }

  return NextResponse.json({ dispatched: due.length, patients: results });
}

// ── Shared escalation path for when a re-check call cannot be placed or fails ─
async function handleRecheckFailed(patient: Patient) {
  try {
    await insertCallAttempt({
      patientId:     patient.id,
      twilioCallSid: null,
      outcome:       "failed",
      isRecheck:     true,
    });

    const alertResult = await sendFamilyAlert({
      patientId:   patient.id,
      patientName: patient.name,
      familyPhone: patient.family_phone ?? null,
      reason:      "missed_dose_reported",
    });

    console.log(`[recheck] Escalation result for ${patient.id}:`, alertResult);

    await updatePatientStatus(patient.id, "no", {
      recheckPending: false,
      recheckDueAt:   null,
    });
  } catch (e) {
    console.error("[recheck] handleRecheckFailed error:", e);
  }
}
