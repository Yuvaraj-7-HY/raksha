// app/api/mood-checks/route.ts
// POST: records mood check (PHQ-2/PHQ-9), evaluates depression alerts & triggers Q9 safety flow
// GET: lists mood checks for a patient

import { NextRequest, NextResponse } from "next/server";
import { insertMoodCheck, getMoodChecks, getCarePlan, getConditionAlerts, insertConditionAlert } from "@/lib/conditionsDb";
import { evaluateConditionAlerts } from "@/lib/conditionAlerts";
import { dispatchUrgentConditionAlert } from "@/lib/conditionDispatcher";
import { db } from "@/lib/supabaseServer";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const patientId = searchParams.get("patient_id");
  const limit = parseInt(searchParams.get("limit") || "20", 10);

  if (!patientId) {
    return NextResponse.json({ error: "Missing required query param: patient_id" }, { status: 400 });
  }

  try {
    const checks = await getMoodChecks(patientId, limit);
    return NextResponse.json({ checks });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { patient_id, questionnaire, answers, total_score } = body;

    if (!patient_id || !questionnaire || !Array.isArray(answers)) {
      return NextResponse.json(
        { error: "Missing required fields: patient_id, questionnaire, answers" },
        { status: 400 }
      );
    }

    const calculatedScore =
      typeof total_score === "number"
        ? total_score
        : answers.reduce((acc, curr) => acc + (Number(curr) || 0), 0);

    const check = await insertMoodCheck({
      patient_id,
      questionnaire,
      answers,
      total_score: calculatedScore,
    });

    // Evaluate alerts
    const carePlan = await getCarePlan(patient_id, "depression");
    const allChecks = await getMoodChecks(patient_id, 10);
    const openAlerts = await getConditionAlerts({
      patientId: patient_id,
      status: "open",
      conditionType: "depression",
    });

    const evaluatedAlerts = evaluateConditionAlerts({
      patientId: patient_id,
      conditionType: "depression",
      thresholds: carePlan.thresholds,
      moodChecks: allChecks,
      existingOpenAlerts: openAlerts,
    });

    const createdAlerts = [];
    let safetyFlowTriggered = false;

    for (const alt of evaluatedAlerts) {
      const saved = await insertConditionAlert(alt);
      createdAlerts.push(saved);

      if (alt.alert_type === "phq9_self_harm") {
        safetyFlowTriggered = true;
      }

      if (alt.severity === "urgent") {
        try {
          const { data: patient } = await db
            .get()
            .from("patients")
            .select("name, family_phone, phone")
            .eq("id", patient_id)
            .single();

          await dispatchUrgentConditionAlert({
            patientId: patient_id,
            patientName: patient?.name || "Patient",
            familyPhone: patient?.family_phone || null,
            conditionType: "depression",
            alertMessage: alt.message,
          });
        } catch (dispatchErr) {
          console.error("[api/mood-checks] Urgent escalation dispatch error:", dispatchErr);
        }
      }
    }

    return NextResponse.json({
      check,
      alerts_created: createdAlerts,
      safety_flow_triggered: safetyFlowTriggered,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
