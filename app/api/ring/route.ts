import { careSecretMatches } from "@/lib/n8n";
import { tryStartRing } from "@/lib/ringState";
import { broadcastRingState } from "@/lib/supabaseBroadcast";
import { makeOutboundCall } from "@/lib/twilio";

export async function POST(req: Request) {
  if (!careSecretMatches(req)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: {
    callId?: string;
    callType?: string;
    context?: string;
    attempt?: number;
    /** E.164 phone number to dial via Twilio. Omit for browser/phone-page mode. */
    to?: string;
  };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }

  const callId = body.callId?.trim();
  if (!callId) {
    return Response.json({ error: "callId required" }, { status: 400 });
  }

  const callType = body.callType?.trim() || "morning";
  const context = body.context?.trim() || "";
  const attempt = typeof body.attempt === "number" ? body.attempt : 0;

  const result = tryStartRing({ callId, callType, context, attempt });

  if (!result.ok) {
    return Response.json({ error: "phone busy" }, { status: 409 });
  }

  void broadcastRingState(result.state);

  // ── Optional: place a real Twilio call ──────────────────────────────────────
  if (body.to?.trim()) {
    try {
      const twilioSid = await makeOutboundCall({
        to: body.to.trim(),
        callId,
        callType,
        context,
        attempt,
      });
      return Response.json(
        { ok: true, state: result.state, twilioSid },
        { status: 200 }
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "twilio error";
      console.error("[ring] Twilio call failed:", message);
      return Response.json({ error: message }, { status: 502 });
    }
  }

  return Response.json({ ok: true, state: result.state }, { status: 200 });
}
