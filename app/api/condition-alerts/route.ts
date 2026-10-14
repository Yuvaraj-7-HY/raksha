// app/api/condition-alerts/route.ts
// GET: lists condition alerts across patients or by patient ID
// PATCH: acknowledges or resolves an alert

import { NextRequest, NextResponse } from "next/server";
import { getConditionAlerts, updateAlertStatus } from "@/lib/conditionsDb";
import type { ConditionType } from "@/types/conditions";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const patientId = searchParams.get("patient_id") || undefined;
  const status = searchParams.get("status") || undefined;
  const conditionType = (searchParams.get("condition_type") as ConditionType) || undefined;
  const limit = parseInt(searchParams.get("limit") || "100", 10);

  try {
    const alerts = await getConditionAlerts({
      patientId,
      status,
      conditionType,
      limit,
    });

    // Sort by severity (urgent > warning > info), then newest first
    const severityRank: Record<string, number> = { urgent: 3, warning: 2, info: 1 };
    alerts.sort((a, b) => {
      const rankDiff = (severityRank[b.severity] || 0) - (severityRank[a.severity] || 0);
      if (rankDiff !== 0) return rankDiff;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    return NextResponse.json({ alerts });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, status } = body;

    if (!id || !["acknowledged", "resolved"].includes(status)) {
      return NextResponse.json(
        { error: "Missing or invalid id / status ('acknowledged' | 'resolved')" },
        { status: 400 }
      );
    }

    const success = await updateAlertStatus(id, status);
    return NextResponse.json({ success, id, status });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
