// scripts/seed-conditions.ts
// Seeds 14 days of realistic readings, mood checks, caregiver logs, and condition tags
// Fake data only — no real phone numbers.

import { db } from "../lib/supabaseServer";
import {
  setPatientCondition,
  insertReading,
  saveCarePlan,
  insertCaregiverLog,
  insertMoodCheck,
  insertConditionAlert,
} from "../lib/conditionsDb";
import { DEFAULT_THRESHOLDS, type ConditionType } from "../types/conditions";
import { getTodayIst } from "../lib/istDate";

async function seed() {
  console.log("\n🌱 Seeding condition-aware clinical data...\n");

  const todayStr = getTodayIst();
  const now = Date.now();

  // Helper to generate ISO timestamp N days ago at specific hour
  function daysAgoIso(days: number, hour: number = 8, minute: number = 0): string {
    const d = new Date(now - days * 86400000);
    d.setHours(hour, minute, 0, 0);
    return d.toISOString();
  }

  // ── Patients mapping ────────────────────────────────────────────────────────
  // We cover:
  // 1. Grandma: Both (Diabetes + Hypertension)
  // 2. Saraswati Nair: Diabetes only
  // 3. Venkat Rao: Hypertension only
  // 4. Lakshmi Devi: Both (Diabetes + Hypertension)
  // 5. Kamala Bai: Dementia
  // 6. Suresh Patel: Depression
  // 7. Ramesh Iyer: Hypertension + Depression

  const PATIENTS: Array<{ id: string; name: string; conditions: ConditionType[] }> = [
    {
      id: "c8d44e9e-9079-496b-b15e-fa2350ca6aab",
      name: "Grandma",
      conditions: ["diabetes", "hypertension"],
    },
    {
      id: "f6a7b8c9-d0e1-2345-f012-456789012345",
      name: "Saraswati Nair",
      conditions: ["diabetes"],
    },
    {
      id: "e5f6a7b8-c9d0-1234-ef01-345678901234",
      name: "Venkat Rao",
      conditions: ["hypertension"],
    },
    {
      id: "b2c3d4e5-f6a7-8901-bcde-f12345678901",
      name: "Lakshmi Devi",
      conditions: ["diabetes", "hypertension"],
    },
    {
      id: "d4e5f6a7-b8c9-0123-def0-234567890123",
      name: "Kamala Bai",
      conditions: ["dementia"],
    },
    {
      id: "c3d4e5f6-a7b8-9012-cdef-123456789012",
      name: "Suresh Patel",
      conditions: ["depression"],
    },
    {
      id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      name: "Ramesh Iyer",
      conditions: ["hypertension", "depression"],
    },
  ];

  for (const p of PATIENTS) {
    console.log(`Setting up patient: ${p.name} (${p.conditions.join(", ")})`);

    // 1. Tag patient conditions & care plans
    for (const cond of p.conditions) {
      await setPatientCondition(p.id, cond, true, "2024-01-15");
      await saveCarePlan(p.id, cond, (DEFAULT_THRESHOLDS as any)[cond], "Dr. Primary Care");

      // ── DIABETES READINGS (14 days) ──
      if (cond === "diabetes") {
        // HbA1c reading 10 days ago
        await insertReading({
          patient_id: p.id,
          condition_type: "diabetes",
          reading_type: "hba1c",
          value: p.name === "Grandma" ? 7.6 : 6.8,
          unit: "%",
          note: "Lab report from diagnostic center",
          source: "clinician",
          recorded_at: daysAgoIso(10, 10, 0),
        });

        for (let d = 13; d >= 0; d--) {
          // Fasting glucose (morning)
          const fastingVal = Math.round(105 + Math.sin(d) * 18 + (d === 1 ? 30 : 0));
          await insertReading({
            patient_id: p.id,
            condition_type: "diabetes",
            reading_type: "glucose_fasting",
            value: fastingVal,
            unit: "mg/dL",
            note: "Pre-breakfast glucometer reading",
            source: "patient",
            recorded_at: daysAgoIso(d, 7, 30),
          });

          // Post-meal glucose (after lunch)
          const postMealVal = Math.round(145 + Math.cos(d) * 25);
          await insertReading({
            patient_id: p.id,
            condition_type: "diabetes",
            reading_type: "glucose_post_meal",
            value: postMealVal,
            unit: "mg/dL",
            note: "2 hrs post lunch",
            source: "patient",
            recorded_at: daysAgoIso(d, 14, 0),
          });
        }
      }

      // ── HYPERTENSION READINGS (14 days) ──
      if (cond === "hypertension") {
        for (let d = 13; d >= 0; d--) {
          const sysVal = Math.round(135 + Math.cos(d) * 12 + (d === 0 ? 8 : 0));
          const diaVal = Math.round(85 + Math.sin(d) * 7);
          const pulseVal = Math.round(72 + Math.cos(d * 2) * 6);

          await insertReading({
            patient_id: p.id,
            condition_type: "hypertension",
            reading_type: "systolic",
            value: sysVal,
            unit: "mmHg",
            note: "Morning BP cuff check",
            source: "patient",
            recorded_at: daysAgoIso(d, 8, 30),
          });

          await insertReading({
            patient_id: p.id,
            condition_type: "hypertension",
            reading_type: "diastolic",
            value: diaVal,
            unit: "mmHg",
            note: "Morning BP cuff check",
            source: "patient",
            recorded_at: daysAgoIso(d, 8, 30),
          });

          await insertReading({
            patient_id: p.id,
            condition_type: "hypertension",
            reading_type: "pulse",
            value: pulseVal,
            unit: "bpm",
            note: "Resting pulse",
            source: "patient",
            recorded_at: daysAgoIso(d, 8, 30),
          });
        }
      }

      // ── DEMENTIA CAREGIVER LOGS (14 days) ──
      if (cond === "dementia") {
        for (let d = 13; d >= 0; d--) {
          const confusion = d === 1 ? 4 : d % 4 === 0 ? 3 : 2;
          const agitated = d === 1 || d === 6;
          await insertCaregiverLog({
            patient_id: p.id,
            logged_by: "Caregiver (Ravi)",
            confusion_level: confusion,
            sleep_quality: d % 3 === 0 ? 2 : 4,
            appetite: 3,
            agitation_or_wandering: agitated,
            medicine_confirmed: d !== 0, // not confirmed today for demo alert
            notes: d === 1 ? "Wandered near gate in the afternoon. Calmed down with tea." : "Stable mood.",
            created_at: daysAgoIso(d, 19, 0),
          });
        }
      }

      // ── DEPRESSION MOOD CHECKS ──
      if (cond === "depression") {
        // 3 weekly checks
        const checks = [
          { daysAgo: 14, score: 6, q: "phq2" as const, answers: [2, 1] },
          { daysAgo: 7, score: 9, q: "phq2" as const, answers: [2, 2] },
          { daysAgo: 1, score: 12, q: "phq9" as const, answers: [2, 2, 1, 1, 1, 1, 2, 2, 0] },
        ];

        for (const c of checks) {
          await insertMoodCheck({
            patient_id: p.id,
            questionnaire: c.q,
            answers: c.answers,
            total_score: c.score,
            created_at: daysAgoIso(c.daysAgo, 16, 0),
          });
        }
      }
    }

    // Seed realistic open demo alert for testing/visualization
    if (p.conditions.includes("hypertension")) {
      await insertConditionAlert({
        patient_id: p.id,
        condition_type: "hypertension",
        severity: "warning",
        alert_type: "bp_warning",
        message: "Elevated blood pressure: 144/92 mmHg (threshold 140/90 mmHg).",
        status: "open",
      });
    }

    if (p.conditions.includes("dementia")) {
      await insertConditionAlert({
        patient_id: p.id,
        condition_type: "dementia",
        severity: "warning",
        alert_type: "dementia_meds_unconfirmed",
        message: "Daily medication adherence was not confirmed by caregiver today.",
        status: "open",
      });
    }

    if (p.conditions.includes("depression")) {
      await insertConditionAlert({
        patient_id: p.id,
        condition_type: "depression",
        severity: "warning",
        alert_type: "phq9_moderate",
        message: "Moderate depression indicator on PHQ-9 (Total Score: 12/27).",
        status: "open",
      });
    }
  }

  console.log("\n✅ Condition seeding complete! 14 days of charts & demo data ready.");
}

seed().catch((err) => {
  console.error("Seeding error:", err);
  process.exit(1);
});
