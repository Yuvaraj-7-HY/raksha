// app/api/care-plans/route.ts
// GET: retrieves care plan & thresholds for a patient condition
// PUT: updates care plan thresholds (clinician-editable)

import { NextRequest, NextResponse } from "next/server";
import { getCarePlan, saveCarePlan } from "@/lib/conditionsDb";
import type { ConditionType } from "@/types/conditions";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const patientId = searchParams.get("patient_id");
  const conditionType = searchParams.get("condition_type") as ConditionType;

  if (!patientId || !conditionType) {
    return NextResponse.json(
      { error: "Missing required query params: patient_id, condition_type" },
      { status: 400 }
    );
  }

  try {
    const plan = await getCarePlan(patientId, conditionType);
    return NextResponse.json({ care_plan: plan });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { patient_id, condition_type, thresholds, updated_by } = body;

    if (!patient_id || !condition_type || !thresholds) {
      return NextResponse.json(
        { error: "Missing required fields: patient_id, condition_type, thresholds" },
        { status: 400 }
      );
    }

    const saved = await saveCarePlan(
      patient_id,
      condition_type as ConditionType,
      thresholds,
      updated_by || "Clinician"
    );

    return NextResponse.json({ care_plan: saved });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
