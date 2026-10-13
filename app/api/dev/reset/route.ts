// app/api/dev/reset/route.ts
// Dev-only: force ring_state back to idle (clears stuck in_call / ringing).

import { endCall, readRingState } from "@/lib/ringState";
import { broadcastRingState } from "@/lib/supabaseBroadcast";

export async function POST() {
  endCall(); // resets globalThis ring state to idle
  void broadcastRingState(readRingState());
  return Response.json({ ok: true, status: "idle" });
}
