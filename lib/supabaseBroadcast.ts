// lib/supabaseBroadcast.ts
// Server-side helper: pushes ring-state snapshots to a Supabase Realtime
// Broadcast channel so the dashboard can receive instant updates without
// polling.  Uses the Supabase REST API directly (no SDK needed server-side).
//
// Channel: "ring-state"
// Event:   "state-update"
//
// This never reads from Supabase — it's fire-and-forget push only.

import { PhoneStateResponse } from "./ringState";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

const BROADCAST_URL = SUPABASE_URL
  ? `${SUPABASE_URL}/realtime/v1/api/broadcast`
  : "";

/**
 * Broadcasts the current ring state to all subscribed dashboard clients.
 * Fire-and-forget — errors are logged but never thrown.
 */
export async function broadcastRingState(state: PhoneStateResponse): Promise<void> {
  if (!BROADCAST_URL || !SUPABASE_ANON_KEY) return;

  try {
    const res = await fetch(BROADCAST_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({
        messages: [
          {
            topic: "realtime:ring-state",
            event: "state-update",
            payload: state,
          },
        ],
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.warn("[supabaseBroadcast] Failed:", res.status, text);
    }
  } catch (err) {
    console.warn("[supabaseBroadcast] Network error:", err);
  }
}
