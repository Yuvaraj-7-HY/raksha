import { acceptCall, readRingState } from "@/lib/ringState";
import { broadcastRingState } from "@/lib/supabaseBroadcast";

export async function POST(req: Request) {
  let body: { callId?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }

  const callId = body.callId?.trim();
  if (!callId) {
    return Response.json({ error: "callId required" }, { status: 400 });
  }

  const result = acceptCall(callId);
  if (!result.ok) {
    return Response.json({ error: "no matching ring" }, { status: 409 });
  }

  void broadcastRingState(readRingState());
  return Response.json({ ok: true }, { status: 200 });
}
