import { randomUUID } from "crypto";
import { tryStartRing } from "@/lib/ringState";
import { broadcastRingState } from "@/lib/supabaseBroadcast";

/**
 * Dev-only ring trigger for the laptop dashboard.
 * n8n will use POST /api/ring + X-Care-Secret instead.
 */
export async function POST(req: Request) {
  let body: {
    callType?: string;
    context?: string;
    attempt?: number;
  } = {};
  try {
    const text = await req.text();
    if (text) body = JSON.parse(text);
  } catch {
    // empty body is fine
  }

  const result = tryStartRing({
    callId: randomUUID(),
    callType: body.callType?.trim() || "morning",
    context:
      body.context?.trim() ||
      "Morning medication check. Ask how she is feeling and whether she took her morning medicines.",
    attempt: typeof body.attempt === "number" ? body.attempt : 0,
  });

  if (!result.ok) {
    return Response.json({ error: "phone busy" }, { status: 409 });
  }

  void broadcastRingState(result.state);
  return Response.json({ ok: true, state: result.state }, { status: 200 });
}
