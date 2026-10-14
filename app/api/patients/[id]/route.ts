// app/api/patients/[id]/route.ts
// GET: full patient details with active conditions, care plans, alerts, and call history

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/supabaseServer";
import { getPatientConditions, getConditionAlerts, getCarePlan } from "@/lib/conditionsDb";
import type { ConditionType } from "@/types/conditions";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const supabase = db.get();
    const { data: patient, error } = await supabase
      .from("patients")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !patient) {
      return NextResponse.json({ error: error?.message || "Patient not found" }, { status: 404 });
    }

    // Active conditions
    const conditions = await getPatientConditions(id);
    const activeConditions = conditions.filter((c) => c.is_active);

    // Care plans for each active condition
    const carePlans = await Promise.all(
      activeConditions.map(async (c) => {
        return getCarePlan(id, c.condition_type as ConditionType);
      })
    );

    // Call attempts history
    const { data: callAttempts } = await supabase
      .from("call_attempts")
      .select("*")
      .eq("patient_id", id)
      .order("created_at", { ascending: false })
      .limit(20);

    // Alerts
    const alerts = await getConditionAlerts({ patientId: id, limit: 50 });

    return NextResponse.json({
      patient,
      conditions: activeConditions,
      care_plans: carePlans,
      call_attempts: callAttempts || [],
      alerts,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const body = await req.json();
    const supabase = db.get();
    const { data, error } = await supabase
      .from("patients")
      .update({
        ...body,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ patient: data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
