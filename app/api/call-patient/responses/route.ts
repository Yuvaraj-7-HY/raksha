// app/api/call-patient/responses/route.ts
// Returns medication check history and latest response for a patient

import { NextRequest, NextResponse } from "next/server";
import { getMedicationChecks, getLatestMedicationCheck } from "@/lib/medication-checks";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const patientId = searchParams.get("patientId") || undefined;

    const records = getMedicationChecks(patientId);
    const latest = patientId ? getLatestMedicationCheck(patientId) : records[0] || null;

    return NextResponse.json({
      success: true,
      records,
      latest: latest || null,
    });
  } catch (err: any) {
    console.error("[call-patient/responses] Error fetching responses:", err);
    return NextResponse.json(
      {
        success: false,
        error: err.message || "Failed to fetch medication checks",
        records: [],
        latest: null,
      },
      { status: 500 }
    );
  }
}
