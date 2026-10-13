// app/api/dev/reset/route.ts
// Dev-only: force ring_state back to idle (clears stuck in_call / ringing).

import { endCall } from "@/lib/ringState";

export async function POST() {
  endCall(); // resets globalThis ring state to idle
  return Response.json({ ok: true, status: "idle" });
}
