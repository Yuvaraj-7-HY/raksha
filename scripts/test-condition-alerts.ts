// scripts/test-condition-alerts.ts
// Unit tests for pure condition alert evaluation logic

import { evaluateConditionAlerts } from "../lib/conditionAlerts";
import type { Reading, MoodCheck, CaregiverLog, ConditionAlert } from "../types/conditions";
import { getTodayIst } from "../lib/istDate";

let passedCount = 0;
let failedCount = 0;

function assert(condition: boolean, testName: string) {
  if (condition) {
    console.log(`  ✅ PASS: ${testName}`);
    passedCount++;
  } else {
    console.error(`  ❌ FAIL: ${testName}`);
    failedCount++;
  }
}

console.log("\n🧪 Running Condition Alerts Evaluation Unit Tests...\n");

const today = getTodayIst();
const patientId = "test-patient-001";

// ── Test 1: High BP creates a warning alert ────────────────────────────────────
{
  const readings: Reading[] = [
    {
      id: "r1",
      patient_id: patientId,
      condition_type: "hypertension",
      reading_type: "systolic",
      value: 150,
      unit: "mmHg",
      source: "patient",
      recorded_at: `${today}T08:00:00+05:30`,
      created_at: `${today}T08:00:00+05:30`,
    },
    {
      id: "r2",
      patient_id: patientId,
      condition_type: "hypertension",
      reading_type: "diastolic",
      value: 95,
      unit: "mmHg",
      source: "patient",
      recorded_at: `${today}T08:00:00+05:30`,
      created_at: `${today}T08:00:00+05:30`,
    },
  ];

  const alerts = evaluateConditionAlerts({
    patientId,
    conditionType: "hypertension",
    readings,
    currentDateIst: today,
  });

  assert(
    alerts.some((a) => a.severity === "warning" && a.alert_type === "bp_warning"),
    "High BP reading (150/95 mmHg) triggers warning alert"
  );
}

// ── Test 2: Critical BP creates urgent alert ──────────────────────────────────
{
  const readings: Reading[] = [
    {
      id: "r1",
      patient_id: patientId,
      condition_type: "hypertension",
      reading_type: "systolic",
      value: 190,
      unit: "mmHg",
      source: "patient",
      recorded_at: `${today}T10:00:00+05:30`,
      created_at: `${today}T10:00:00+05:30`,
    },
    {
      id: "r2",
      patient_id: patientId,
      condition_type: "hypertension",
      reading_type: "diastolic",
      value: 125,
      unit: "mmHg",
      source: "patient",
      recorded_at: `${today}T10:00:00+05:30`,
      created_at: `${today}T10:00:00+05:30`,
    },
  ];

  const alerts = evaluateConditionAlerts({
    patientId,
    conditionType: "hypertension",
    readings,
    currentDateIst: today,
  });

  assert(
    alerts.some((a) => a.severity === "urgent" && a.alert_type === "bp_urgent"),
    "Critical BP (190/125 mmHg) triggers urgent alert"
  );
}

// ── Test 3: Urgent low glucose (<70 mg/dL) ────────────────────────────────────
{
  const readings: Reading[] = [
    {
      id: "rg1",
      patient_id: patientId,
      condition_type: "diabetes",
      reading_type: "glucose_fasting",
      value: 62,
      unit: "mg/dL",
      source: "patient",
      recorded_at: `${today}T07:30:00+05:30`,
      created_at: `${today}T07:30:00+05:30`,
    },
  ];

  const alerts = evaluateConditionAlerts({
    patientId,
    conditionType: "diabetes",
    readings,
    currentDateIst: today,
  });

  assert(
    alerts.some((a) => a.severity === "urgent" && a.alert_type === "glucose_urgent_low"),
    "Low blood glucose (62 mg/dL) triggers urgent alert"
  );
}

// ── Test 4: Urgent high glucose (>250 mg/dL) ───────────────────────────────────
{
  const readings: Reading[] = [
    {
      id: "rg2",
      patient_id: patientId,
      condition_type: "diabetes",
      reading_type: "glucose_post_meal",
      value: 285,
      unit: "mg/dL",
      source: "patient",
      recorded_at: `${today}T14:30:00+05:30`,
      created_at: `${today}T14:30:00+05:30`,
    },
  ];

  const alerts = evaluateConditionAlerts({
    patientId,
    conditionType: "diabetes",
    readings,
    currentDateIst: today,
  });

  assert(
    alerts.some((a) => a.severity === "urgent" && a.alert_type === "glucose_urgent_high"),
    "High blood glucose (285 mg/dL) triggers urgent alert"
  );
}

// ── Test 5: Fasting glucose warning (>130 mg/dL) ──────────────────────────────
{
  const readings: Reading[] = [
    {
      id: "rg3",
      patient_id: patientId,
      condition_type: "diabetes",
      reading_type: "glucose_fasting",
      value: 145,
      unit: "mg/dL",
      source: "patient",
      recorded_at: `${today}T07:00:00+05:30`,
      created_at: `${today}T07:00:00+05:30`,
    },
  ];

  const alerts = evaluateConditionAlerts({
    patientId,
    conditionType: "diabetes",
    readings,
    currentDateIst: today,
  });

  assert(
    alerts.some((a) => a.severity === "warning" && a.alert_type === "glucose_fasting_warning"),
    "Elevated fasting glucose (145 mg/dL) triggers warning alert"
  );
}

// ── Test 6: PHQ-9 Question 9 self-harm thoughts triggers urgent safety flow ────
{
  const moodChecks: MoodCheck[] = [
    {
      id: "mc1",
      patient_id: patientId,
      questionnaire: "phq9",
      // Answers 1-9; Q9 is index 8 with score 1
      answers: [1, 0, 1, 1, 0, 0, 1, 0, 1],
      total_score: 5,
      created_at: `${today}T11:00:00+05:30`,
    },
  ];

  const alerts = evaluateConditionAlerts({
    patientId,
    conditionType: "depression",
    moodChecks,
    currentDateIst: today,
  });

  assert(
    alerts.some((a) => a.severity === "urgent" && a.alert_type === "phq9_self_harm"),
    "PHQ-9 Q9 answer > 0 triggers urgent safety alert"
  );
}

// ── Test 7: Rising PHQ scores across checks creates warning ───────────────────
{
  const moodChecks: MoodCheck[] = [
    {
      id: "mc3",
      patient_id: patientId,
      questionnaire: "phq2",
      answers: [2, 2],
      total_score: 4,
      created_at: `${today}T11:00:00+05:30`,
    },
    {
      id: "mc2",
      patient_id: patientId,
      questionnaire: "phq2",
      answers: [1, 2],
      total_score: 3,
      created_at: "2026-10-07T11:00:00+05:30",
    },
    {
      id: "mc1",
      patient_id: patientId,
      questionnaire: "phq2",
      answers: [1, 0],
      total_score: 1,
      created_at: "2026-09-30T11:00:00+05:30",
    },
  ];

  const alerts = evaluateConditionAlerts({
    patientId,
    conditionType: "depression",
    moodChecks,
    currentDateIst: today,
  });

  assert(
    alerts.some((a) => a.severity === "warning" && a.alert_type === "phq_score_rising"),
    "Worsening mood trend (scores rising 2 checks in a row) triggers warning alert"
  );
}

// ── Test 8: Dementia high confusion & agitation triggers warning ───────────────
{
  const caregiverLogs: CaregiverLog[] = [
    {
      id: "cl1",
      patient_id: patientId,
      logged_by: "Caregiver",
      confusion_level: 4,
      sleep_quality: 2,
      appetite: 3,
      agitation_or_wandering: true,
      medicine_confirmed: false,
      notes: "Restless afternoon",
      created_at: `${today}T15:00:00+05:30`,
    },
  ];

  const alerts = evaluateConditionAlerts({
    patientId,
    conditionType: "dementia",
    caregiverLogs,
    currentDateIst: today,
  });

  assert(
    alerts.some((a) => a.severity === "warning" && a.alert_type === "confusion_high"),
    "High confusion level (4/5) triggers warning alert"
  );
  assert(
    alerts.some((a) => a.severity === "warning" && a.alert_type === "agitation_wandering"),
    "Agitation/wandering behavior triggers warning alert"
  );
}

// ── Test 9: Inactivity check: 3 days without a reading creates an alert ────────
{
  // Last reading was 4 days ago
  const oldDate = new Date(Date.now() - 4 * 86400000).toISOString();
  const readings: Reading[] = [
    {
      id: "rold",
      patient_id: patientId,
      condition_type: "diabetes",
      reading_type: "glucose_fasting",
      value: 110,
      unit: "mg/dL",
      source: "patient",
      recorded_at: oldDate,
      created_at: oldDate,
    },
  ];

  const alerts = evaluateConditionAlerts({
    patientId,
    conditionType: "diabetes",
    readings,
    currentDateIst: today,
  });

  assert(
    alerts.some((a) => a.severity === "warning" && a.alert_type === "no_glucose_3d"),
    "4 days without glucose reading triggers 3-day inactivity warning alert"
  );
}

// ── Test 10: Deduplication prevents duplicate open alerts on same day ─────────
{
  const readings: Reading[] = [
    {
      id: "rg1",
      patient_id: patientId,
      condition_type: "diabetes",
      reading_type: "glucose_fasting",
      value: 62,
      unit: "mg/dL",
      source: "patient",
      recorded_at: `${today}T08:30:00+05:30`,
      created_at: `${today}T08:30:00+05:30`,
    },
  ];

  const existingOpenAlerts: ConditionAlert[] = [
    {
      id: "alt_existing",
      patient_id: patientId,
      condition_type: "diabetes",
      severity: "urgent",
      alert_type: "glucose_urgent_low",
      message: "Urgent: Low blood glucose of 60 mg/dL detected.",
      status: "open",
      created_at: `${today}T07:00:00+05:30`,
    },
  ];

  const alerts = evaluateConditionAlerts({
    patientId,
    conditionType: "diabetes",
    readings,
    existingOpenAlerts,
    currentDateIst: today,
  });

  assert(
    alerts.length === 0,
    "Deduplication prevents creating second open alert of same type on same IST day"
  );
}

console.log(`\nResults: ${passedCount} passed, ${failedCount} failed.`);
if (failedCount > 0) process.exit(1);
