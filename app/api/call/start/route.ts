// app/api/call/start/route.ts
// Protected: starts a call (Twilio or web), creates calls row

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { randomUUID } from "crypto";
import { twilioClient, TWILIO_FROM_NUMBER, validateTwilioSignature } from "@/lib/twilio";
import { createCall, getCallsDb } from "@/lib/calls-db";
import { PUBLIC_BASE_URL, ALLOWED_TO_NUMBERS, DEFAULT_TO_NUMBER, TRANSPORT } from "@/lib/config";

const allowedNumbers = ALLOWED_TO_NUMBERS.split(",").map(s => s.trim()).filter(Boolean);

export async function POST(req: Request) {
  // Admin auth checked by middleware

  let body: { callType?: string; context?: string; attempt?: number; to?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }

  const callType = body.callType ?? "morning";
  const context = body.context ?? null;
  const attempt = typeof body.attempt === "number" ? body.attempt : 1;
  const to = (body.to ?? DEFAULT_TO_NUMBER ?? "").trim();

  if (!to) {
    return Response.json({ error: "to number required" }, { status: 400 });
  }
  if (!allowedNumbers.includes(to)) {
    return Response.json({ error: "number not allowed" }, { status: 403 });
  }

  const callId = randomUUID();
  const now = new Date().toISOString();

  // Create call row
  createCall({ id: callId, call_type: callType, context, attempt, to_number: to });

  if (TRANSPORT === "twilio") {
    if (!PUBLIC_BASE_URL) {
      return Response.json({ error: "PUBLIC_BASE_URL not set" }, { status: 500 });
    }

    try {
      const call = await twilioClient.calls.create({
        to,
        from: TWILIO_FROM_NUMBER,
        url: `${PUBLIC_BASE_URL}/api/twilio/voice?callId=${callId}`,
        method: "POST",
        statusCallback: `${PUBLIC_BASE_URL}/api/twilio/status?callId=${callId}`,
        statusCallbackEvent: ["initiated", "ringing", "answered", "completed"],
        statusCallbackMethod: "POST",
        timeout: 30,
      });

      // Update with Twilio SID
      getCallsDb().prepare("UPDATE calls SET twilio_call_sid = ?, status = 'queued' WHERE id = ?").run(call.sid, callId);

      return Response.json({ callId, twilioCallSid: call.sid });
    } catch (e: any) {
      console.error("[call/start] Twilio error:", e);
      return Response.json({ error: e.message ?? "twilio call failed" }, { status: 500 });
    }
  } else {
    // Web transport — ring the existing phone page via ring_state
    // This keeps the existing web phone flow working
    const { tryStartRing } = await import("@/lib/ringState");
    const result = tryStartRing({ callId, callType, context: context ?? "", attempt });
    if (!result.ok) {
      return Response.json({ error: "phone busy" }, { status: 409 });
    }
    return Response.json({ callId });
  }
}