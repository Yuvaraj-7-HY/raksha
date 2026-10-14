// app/api/demo-state/route.ts
// GET: Returns the latest call attempt with status "ringing" as { call: { id, attempt_no } | null }
// Server-side only, minimal fields.

import { NextResponse } from "next/server";
import { db } from "@/lib/supabaseServer";
import { readRingState } from "@/lib/ringState";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // 1. Check in-memory ring state (updated in real-time by mockProvider)
    const ringState = readRingState();
    if (ringState.status === "ringing" && ringState.callId) {
      return NextResponse.json({
        call: {
          id: ringState.callId,
          attempt_no: ringState.attempt || 1,
          patient_name: ringState.patientName || "Patient",
        },
      });
    }

    // 2. Also check Supabase call_attempts if status column exists
    try {
      const supabase = db.get();
      const { data, error } = await supabase
        .from("call_attempts")
        .select("id, attempt_number, status")
        .eq("status", "ringing")
        .order("created_at", { ascending: false })
        .limit(1);

      if (!error && data && data.length > 0) {
        const attempt = data[0];
        return NextResponse.json({
          call: {
            id: attempt.id,
            attempt_no: attempt.attempt_number || 1,
          },
        });
      }
    } catch {
      // Fall through to null
    }

    return NextResponse.json({ call: null });
  } catch (err: any) {
    console.error("[demo-state] Error:", err);
    return NextResponse.json({ call: null, error: err.message }, { status: 500 });
  }
}
