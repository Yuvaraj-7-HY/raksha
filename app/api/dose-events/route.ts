// app/api/dose-events/route.ts
// REST endpoint for the Today page to poll for pending dose events (e.g. "taken" from Twilio IVR)
// GET  → returns all unconsumed events
// POST → marks a list of eventIds as consumed

import { NextRequest, NextResponse } from "next/server";
import { getPendingDoseEvents, consumeDoseEvents, appendDoseEvent } from "@/lib/dose-events";

/** GET /api/dose-events?patientId=xxx
 *  Returns pending (unconsumed) dose events. */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const patientId = searchParams.get("patientId") || undefined;
  const events = getPendingDoseEvents(patientId);
  return NextResponse.json({ events });
}

/** POST /api/dose-events
 *  Body: { consume: string[] }  → marks those event IDs as consumed
 *  Body: { event: { doseId, patientId, eventType, medicineName?, source? } } → manual append
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));

    if (body.consume && Array.isArray(body.consume)) {
      consumeDoseEvents(body.consume);
      return NextResponse.json({ success: true, consumed: body.consume.length });
    }

    if (body.event) {
      const { doseId, patientId, eventType, medicineName, source } = body.event;
      if (!doseId || !patientId || !eventType) {
        return NextResponse.json({ success: false, error: "Missing doseId, patientId, or eventType" }, { status: 400 });
      }
      const ev = appendDoseEvent({ doseId, patientId, eventType, medicineName, source });
      return NextResponse.json({ success: true, event: ev });
    }

    return NextResponse.json({ success: false, error: "No valid action specified" }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
