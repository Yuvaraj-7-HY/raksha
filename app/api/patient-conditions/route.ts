// app/api/patient-conditions/route.ts
// GET: lists conditions for a patient
// POST: adds/enables a condition for a patient (switches on module)
// DELETE: removes/disables a condition for a patient

import { NextRequest, NextResponse } from "next/server";
import { getPatientConditions, setPatientCondition, saveCarePlan } from "@/lib/conditionsDb";
import { DEFAULT_THRESHOLDS } from "@/types/conditions";
import type { ConditionType } from "@/types/conditions";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const patientId = searchParams.get("patient_id");

  if (!patientId) {
    return NextResponse.json({ error: "Missing required query param: patient_id" }, { status: 400 });
  }

  try {
    const conditions = await getPatientConditions(patientId);
    return NextResponse.json({ conditions });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { patient_id, condition_type, diagnosed_on } = body;

    if (!patient_id || !condition_type) {
      return NextResponse.json(
        { error: "Missing required fields: patient_id, condition_type" },
        { status: 400 }
      );
    }

    await setPatientCondition(patient_id, condition_type as ConditionType, true, diagnosed_on);

    // Initialize default thresholds if not already created
    if (DEFAULT_THRESHOLDS[condition_type as ConditionType]) {
      await saveCarePlan(
        patient_id,
        condition_type as ConditionType,
        DEFAULT_THRESHOLDS[condition_type as ConditionType],
        "Care Team (Default)"
      );
    }

    const conditions = await getPatientConditions(patient_id);
    return NextResponse.json({ success: true, conditions });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
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
    await setPatientCondition(patientId, conditionType, false);
    const conditions = await getPatientConditions(patientId);
    return NextResponse.json({ success: true, conditions });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
