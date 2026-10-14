// app/api/cron/condition-check/route.ts
// Scheduled check (callable by Vercel cron and a dashboard button)
// Protected by CARE_SHARED_SECRET
// Creates "no reading for 3 days" and daily dementia check alerts.

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/supabaseServer";
import { getPatientConditions, getReadings, getCaregiverLogs, getCarePlan, getConditionAlerts, insertConditionAlert } from "@/lib/conditionsDb";
import { evaluateConditionAlerts } from "@/lib/conditionAlerts";
import { CARE_SHARED_SECRET } from "@/lib/config";

export async function GET(req: NextRequest) {
  return handleCheck(req);
}

export async function POST(req: NextRequest) {
  return handleCheck(req);
}

async function handleCheck(req: NextRequest) {
  // Authorization check
  const authHeader = req.headers.get("authorization") || "";
  const secretHeader = req.headers.get("x-care-shared-secret") || "";
  const querySecret = new URL(req.url).searchParams.get("secret") || "";

  const providedSecret =
    secretHeader ||
    (authHeader.startsWith("Bearer ") ? authHeader.substring(7) : authHeader) ||
    querySecret;

  const expectedSecret = CARE_SHARED_SECRET || process.env.CARE_SHARED_SECRET || "";

  if (expectedSecret && providedSecret !== expectedSecret) {
    return NextResponse.json({ error: "Unauthorized: Invalid or missing CARE_SHARED_SECRET" }, { status: 401 });
  }

  try {
    const supabase = db.get();
    const { data: patients, error: pError } = await supabase
      .from("patients")
      .select("id, name, is_active")
      .eq("is_active", true);

    if (pError || !patients) {
      return NextResponse.json({ error: pError?.message || "Failed to load patients" }, { status: 500 });
    }

    let totalAlertsCreated = 0;
    const alertDetails: any[] = [];

    for (const patient of patients) {
      const conditions = await getPatientConditions(patient.id);

      for (const cond of conditions) {
        if (!cond.is_active) continue;

        const carePlan = await getCarePlan(patient.id, cond.condition_type);
        const openAlerts = await getConditionAlerts({
          patientId: patient.id,
          status: "open",
          conditionType: cond.condition_type,
        });

        let readings = undefined;
        let caregiverLogs = undefined;

        if (cond.condition_type === "diabetes" || cond.condition_type === "hypertension") {
          readings = await getReadings({
            patientId: patient.id,
            conditionType: cond.condition_type,
            limit: 20,
          });
        }

        if (cond.condition_type === "dementia") {
          caregiverLogs = await getCaregiverLogs(patient.id, 10);
        }

        const newAlerts = evaluateConditionAlerts({
          patientId: patient.id,
          conditionType: cond.condition_type,
          thresholds: carePlan.thresholds,
          readings,
          caregiverLogs,
          existingOpenAlerts: openAlerts,
        });

        for (const alt of newAlerts) {
          const created = await insertConditionAlert(alt);
          totalAlertsCreated++;
          alertDetails.push({
            patient_id: patient.id,
            patient_name: patient.name,
            condition_type: cond.condition_type,
            severity: alt.severity,
            message: alt.message,
          });
        }
      }
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      patients_evaluated: patients.length,
      alerts_created_count: totalAlertsCreated,
      alerts: alertDetails,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
