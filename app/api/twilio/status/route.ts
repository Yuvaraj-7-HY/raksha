// app/api/twilio/status/route.ts
// Public: Twilio status callback — updates call status, triggers W2/W3 on terminal states, syncs to Supabase

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { twilioClient, TWILIO_FROM_NUMBER, validateTwilioSignature } from "@/lib/twilio";
import { getCall, markFinalized, setCallEnded, setResult, parseHistory } from "@/lib/calls-db";
import { upsertTimeline, type TimelineInsert } from "@/lib/supabase";
import { PUBLIC_BASE_URL, TWILIO_AUTH_TOKEN, TWILIO_VALIDATE, N8N_BASE_URL, N8N_WEBHOOK_PREFIX, CARE_SHARED_SECRET } from "@/lib/config";

const TERMINAL_STATUSES = ["completed", "busy", "failed", "no-answer", "canceled"];

function mapW2ToTimeline(callId: string, callType: string, callStatus: string, attempt: number, transcript: { role: string; text: string; ts: number }[], w2Result: any): TimelineInsert {
  // Default values
  const medicationSlot = callType === "evening" || callType === "followup" ? "evening" : "morning";
  
  // Extract from W2 result (n8n care-call-ended output)
  const concernLevel = w2Result?.concern_level ?? 1;
  const emergency = w2Result?.emergency ?? false;
  const medicationTaken = w2Result?.medication_taken ?? "unclear";
  const symptom = w2Result?.symptom ?? null;
  const severity = w2Result?.severity ?? "none";
  const symptomTrend = w2Result?.symptom_trend ?? "not_applicable";
  const summary = w2Result?.summary ?? "Call completed";
  const followUpNeeded = w2Result?.follow_up_needed ?? false;
  const followUpContext = w2Result?.follow_up_context ?? "";

  // Determine outcome
  let outcome: TimelineInsert["outcome"] = "completed";
  if (callStatus === "busy") outcome = "busy";
  else if (callStatus === "failed") outcome = "failed";
  else if (callStatus === "no-answer") outcome = "no-answer";
  else if (callStatus === "canceled") outcome = "canceled";

  // Build enriched summary with follow-up context
  let finalSummary = summary;
  if (followUpNeeded && followUpContext) {
    finalSummary += ` | Follow-up: ${followUpContext}`;
  }

  return {
    call_id: callId,
    call_type: callType,
    outcome,
    medication_slot: medicationSlot,
    medication_taken: medicationTaken,
    symptom,
    severity,
    symptom_trend: symptomTrend,
    concern_level: concernLevel as 1 | 2 | 3,
    emergency,
    summary: finalSummary,
    transcript_json: JSON.stringify(transcript),
  };
}

function mapW3ToTimeline(callId: string, callType: string, callStatus: string, attempt: number): TimelineInsert {
  const medicationSlot = callType === "evening" || callType === "followup" ? "evening" : "morning";
  
  return {
    call_id: callId,
    call_type: callType,
    outcome: callStatus as TimelineInsert["outcome"],
    medication_slot: medicationSlot,
    medication_taken: "not_asked",
    symptom: null,
    severity: "none",
    symptom_trend: "not_applicable",
    concern_level: 1,
    emergency: false,
    summary: `Call ${callStatus} (attempt ${attempt})`,
    transcript_json: "[]",
  };
}

async function callN8nW2(callId: string, callType: string, attempt: number, transcript: { role: string; text: string; ts: number }[]) {
  const url = `${N8N_BASE_URL}/${N8N_WEBHOOK_PREFIX}/care-call-ended`;
  const body = { callId, callType, attempt, transcript };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Care-Secret": CARE_SHARED_SECRET,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
      cache: "no-store",
    });
    clearTimeout(timeout);
    if (!res.ok) throw new Error(`W2 responded ${res.status}`);
    return await res.json();
  } catch (e) {
    clearTimeout(timeout);
    console.warn("[twilio/status] W2 call failed:", e);
    return { error: String(e) };
  }
}

async function callN8nW3(callId: string, callType: string, attempt: number, reason: string) {
  const url = `${N8N_BASE_URL}/${N8N_WEBHOOK_PREFIX}/care-missed`;
  const body = { callId, callType, attempt, reason };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Care-Secret": CARE_SHARED_SECRET,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
      cache: "no-store",
    });
    clearTimeout(timeout);
    if (!res.ok) throw new Error(`W3 responded ${res.status}`);
    return await res.json();
  } catch (e) {
    clearTimeout(timeout);
    console.warn("[twilio/status] W3 call failed:", e);
    return { error: String(e) };
  }
}

export async function POST(req: Request) {
  // Validate Twilio signature
  const signature = req.headers.get("x-twilio-signature");
  const url = `${PUBLIC_BASE_URL}/api/twilio/status?${req.url.split("?")[1] ?? ""}`;
  const formData = await req.formData();
  const params: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    params[key] = String(value);
  }

  if (TWILIO_VALIDATE && !validateTwilioSignature(TWILIO_AUTH_TOKEN, signature, url, params)) {
    console.warn("[twilio/status] Invalid signature");
    return new Response("Unauthorized", { status: 401 });
  }

  const callId = params.callId ?? new URL(req.url).searchParams.get("callId");
  const callStatus = params.CallStatus;

  if (!callId || !callStatus) {
    console.warn("[twilio/status] Missing callId or CallStatus");
    return new Response("OK", { status: 200 });
  }

  const call = getCall(callId);
  if (!call) {
    console.warn("[twilio/status] Call not found:", callId);
    return new Response("OK", { status: 200 });
  }

  // Update status
  const { getCallsDb } = await import("@/lib/calls-db");
  const db = getCallsDb();
  db.prepare("UPDATE calls SET status = ? WHERE id = ?").run(callStatus, callId);

  // Handle terminal states idempotently
  if (TERMINAL_STATUSES.includes(callStatus)) {
    if (markFinalized(callId)) {
      setCallEnded(callId);

      const transcript = parseHistory(call.history_json);
      const hadConversation = transcript.some(t => t.role === "grandma");

      let result: unknown;
      let timelineRow: TimelineInsert;

      if (callStatus === "completed" && hadConversation) {
        result = await callN8nW2(callId, call.call_type, call.attempt, transcript);
        timelineRow = mapW2ToTimeline(callId, call.call_type, callStatus, call.attempt, transcript, result);
      } else {
        result = await callN8nW3(callId, call.call_type, call.attempt, callStatus);
        timelineRow = mapW3ToTimeline(callId, call.call_type, callStatus, call.attempt);
      }
      setResult(callId, result);

      // Sync to Supabase (non-blocking)
      upsertTimeline(timelineRow).catch(e => console.error("[twilio/status] Supabase sync failed:", e));
    }
  }

  return new Response("OK", { status: 200 });
}