// app/api/readings/route.ts
// POST: adds a reading with server validation and triggers alert evaluation
// GET: lists readings by patient, condition, type and date range

import { NextRequest, NextResponse } from "next/server";
import { insertReading, getReadings, getCarePlan, getConditionAlerts, insertConditionAlert } from "@/lib/conditionsDb";
import { evaluateConditionAlerts } from "@/lib/conditionAlerts";
import { dispatchUrgentConditionAlert } from "@/lib/conditionDispatcher";
import { db } from "@/lib/supabaseServer";
import type { ConditionType, ReadingType, ReadingSource } from "@/types/conditions";

// Server-side validation ranges
const VALUE_RANGES: Record<string, { min: number; max: number; label: string }> = {
  glucose_fasting: { min: 20, max: 600, label: "Fasting Glucose (20 - 600 mg/dL)" },
  glucose_post_meal: { min: 20, max: 600, label: "Post-Meal Glucose (20 - 600 mg/dL)" },
  glucose_bedtime: { min: 20, max: 600, label: "Bedtime Glucose (20 - 600 mg/dL)" },
  hba1c: { min: 3.5, max: 20, label: "HbA1c (3.5 - 20 %)" },
  systolic: { min: 50, max: 260, label: "Systolic BP (50 - 260 mmHg)" },
  diastolic: { min: 30, max: 160, label: "Diastolic BP (30 - 160 mmHg)" },
  pulse: { min: 30, max: 220, label: "Pulse Rate (30 - 220 bpm)" },
  mood_score: { min: 0, max: 27, label: "Mood Score (0 - 27)" },
  sleep_hours: { min: 0, max: 24, label: "Sleep Hours (0 - 24)" },
  confusion_level: { min: 1, max: 5, label: "Confusion Level (1 - 5)" },
  appetite: { min: 1, max: 5, label: "Appetite Score (1 - 5)" },
};

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const patientId = searchParams.get("patient_id");
  const conditionType = searchParams.get("condition_type") as ConditionType | null;
  const readingType = searchParams.get("reading_type") as ReadingType | null;
  const from = searchParams.get("from") || undefined;
  const to = searchParams.get("to") || undefined;
  const limit = parseInt(searchParams.get("limit") || "100", 10);

  if (!patientId) {
    return NextResponse.json({ error: "Missing required query param: patient_id" }, { status: 400 });
  }

  try {
    const readings = await getReadings({
      patientId,
      conditionType: conditionType || undefined,
      readingType: readingType || undefined,
      from,
      to,
      limit,
    });
    return NextResponse.json({ readings });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { patient_id, condition_type, reading_type, value, unit, note, source, recorded_at } = body;

    // Validation
    if (!patient_id || !condition_type || !reading_type || value === undefined || value === null) {
      return NextResponse.json(
        { error: "Missing required fields: patient_id, condition_type, reading_type, value" },
        { status: 400 }
      );
    }

    const numValue = Number(value);
    if (isNaN(numValue)) {
      return NextResponse.json({ error: "Reading value must be a valid number" }, { status: 400 });
    }

    // Server-side physiological range validation
    const range = VALUE_RANGES[reading_type];
    if (range && (numValue < range.min || numValue > range.max)) {
      return NextResponse.json(
        {
          error: `Physiologically impossible reading for ${reading_type}: ${numValue}. Must be between ${range.min} and ${range.max}.`,
        },
        { status: 400 }
      );
    }

    // Insert reading
    const newReading = await insertReading({
      patient_id,
      condition_type: condition_type as ConditionType,
      reading_type: reading_type as ReadingType,
      value: numValue,
      unit: unit || "",
      note: note || null,
      source: (source as ReadingSource) || "patient",
      recorded_at: recorded_at || new Date().toISOString(),
    });

    // Run pure alert evaluation function
    const carePlan = await getCarePlan(patient_id, condition_type as ConditionType);
    const recentReadings = await getReadings({
      patientId: patient_id,
      conditionType: condition_type as ConditionType,
      limit: 20,
    });
    const openAlerts = await getConditionAlerts({
      patientId: patient_id,
      status: "open",
      conditionType: condition_type as ConditionType,
    });

    const evaluatedAlerts = evaluateConditionAlerts({
      patientId: patient_id,
      conditionType: condition_type as ConditionType,
      thresholds: carePlan.thresholds,
      readings: recentReadings,
      existingOpenAlerts: openAlerts,
    });

    const createdAlerts = [];
    for (const alt of evaluatedAlerts) {
      const savedAlert = await insertConditionAlert(alt);
      createdAlerts.push(savedAlert);

      // If alert is urgent, trigger family notification / escalation
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
            conditionType: condition_type as ConditionType,
            alertMessage: alt.message,
          });
        } catch (dispatchErr) {
          console.error("[api/readings] Error in urgent alert dispatch:", dispatchErr);
        }
      }
    }

    return NextResponse.json({
      reading: newReading,
      alerts_created: createdAlerts,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
