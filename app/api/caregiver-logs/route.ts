// app/api/caregiver-logs/route.ts
// POST: records caregiver log (mainly dementia) and triggers alert evaluation
// GET: lists caregiver logs for a patient

import { NextRequest, NextResponse } from "next/server";
import { insertCaregiverLog, getCaregiverLogs, getCarePlan, getConditionAlerts, insertConditionAlert } from "@/lib/conditionsDb";
import { evaluateConditionAlerts } from "@/lib/conditionAlerts";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const patientId = searchParams.get("patient_id");
  const limit = parseInt(searchParams.get("limit") || "20", 10);

  if (!patientId) {
    return NextResponse.json({ error: "Missing required query param: patient_id" }, { status: 400 });
  }

  try {
    const logs = await getCaregiverLogs(patientId, limit);
    return NextResponse.json({ logs });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      patient_id,
      logged_by,
      confusion_level,
      sleep_quality,
      appetite,
      agitation_or_wandering,
      medicine_confirmed,
      notes,
    } = body;

    if (!patient_id || confusion_level === undefined || sleep_quality === undefined || appetite === undefined) {
      return NextResponse.json(
        { error: "Missing required fields: patient_id, confusion_level, sleep_quality, appetite" },
        { status: 400 }
      );
    }

    const cLevel = Number(confusion_level);
    const sQuality = Number(sleep_quality);
    const app = Number(appetite);

    if (cLevel < 1 || cLevel > 5 || sQuality < 1 || sQuality > 5 || app < 1 || app > 5) {
      return NextResponse.json(
        { error: "Scales for confusion, sleep, and appetite must be between 1 and 5" },
        { status: 400 }
      );
    }

    const log = await insertCaregiverLog({
      patient_id,
      logged_by: logged_by || "Caregiver",
      confusion_level: cLevel,
      sleep_quality: sQuality,
      appetite: app,
      agitation_or_wandering: Boolean(agitation_or_wandering),
      medicine_confirmed: Boolean(medicine_confirmed),
      notes: notes || null,
    });

    // Evaluate dementia alerts
    const carePlan = await getCarePlan(patient_id, "dementia");
    const logs = await getCaregiverLogs(patient_id, 14);
    const openAlerts = await getConditionAlerts({
      patientId: patient_id,
      status: "open",
      conditionType: "dementia",
    });

    const evaluatedAlerts = evaluateConditionAlerts({
      patientId: patient_id,
      conditionType: "dementia",
      thresholds: carePlan.thresholds,
      caregiverLogs: logs,
      existingOpenAlerts: openAlerts,
    });

    const createdAlerts = [];
    for (const alt of evaluatedAlerts) {
      const saved = await insertConditionAlert(alt);
      createdAlerts.push(saved);
    }

    return NextResponse.json({
      log,
      alerts_created: createdAlerts,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
