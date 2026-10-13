import { callN8nWebhook } from "@/lib/n8n";
import { endCall, readRingState } from "@/lib/ringState";

type TranscriptEntry = { role: string; text: string; ts?: number };

export async function POST(req: Request) {
  let body: {
    callId?: string;
    callType?: string;
    reason?: string;
    attempt?: number;
    transcript?: TranscriptEntry[];
  };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }

  const reason = body.reason ?? "completed";
  if (!["completed", "missed", "declined"].includes(reason)) {
    return Response.json({ error: "invalid reason" }, { status: 400 });
  }

  const callId = body.callId?.trim() ?? null;
  const callType = body.callType ?? "morning";
  const attempt = typeof body.attempt === "number" ? body.attempt : 0;
  const transcript = Array.isArray(body.transcript) ? body.transcript : [];

  endCall(callId ?? undefined);

  // Ship the full conversation to n8n (W2 completed / W3 missed|declined).
  const n8nPath =
    reason === "completed" ? "care-call-ended" : "care-missed";
  const n8nBody =
    reason === "completed"
      ? { callId, callType, attempt, transcript }
      : { callId, callType, attempt, reason, transcript };

  let n8nOk = false;
  let n8nError: string | null = null;
  try {
    await callN8nWebhook(n8nPath, n8nBody, 8000);
    n8nOk = true;
  } catch (err) {
    n8nError = err instanceof Error ? err.message : "unknown";
    console.warn(`[end] n8n ${n8nPath} unavailable:`, n8nError);
  }

  console.log("[call-ended]", {
    callId,
    callType,
    reason,
    attempt,
    transcriptEntries: transcript.length,
    n8nOk,
    n8nError,
  });

  return Response.json(
    { ok: true, state: readRingState(), n8n: n8nOk ? "ok" : "unavailable" },
    { status: 200 },
  );
}
