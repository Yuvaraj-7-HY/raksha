// lib/conditionAlerts.ts
// Pure alert evaluation logic for condition-aware monitoring

import type {
  ConditionType,
  Reading,
  MoodCheck,
  CaregiverLog,
  ConditionAlert,
  AlertSeverity,
} from "@/types/conditions";
import { DEFAULT_THRESHOLDS } from "@/types/conditions";
import { getTodayIst, toIstDateString, daysAgoInIst } from "./istDate";

export interface EvaluationInput {
  patientId: string;
  conditionType: ConditionType;
  thresholds?: Record<string, any>;
  readings?: Reading[];
  moodChecks?: MoodCheck[];
  caregiverLogs?: CaregiverLog[];
  existingOpenAlerts?: ConditionAlert[];
  currentDateIst?: string; // YYYY-MM-DD
}

export interface GeneratedAlert {
  patient_id: string;
  condition_type: ConditionType;
  severity: AlertSeverity;
  alert_type: string;
  message: string;
  related_reading_id?: string | null;
  status: "open";
}

/**
 * Pure evaluation function. Takes the latest data and thresholds and returns
 * new alerts to be created, preventing duplicate open alerts of the same type
 * on the same IST calendar day.
 */
export function evaluateConditionAlerts(input: EvaluationInput): GeneratedAlert[] {
  const {
    patientId,
    conditionType,
    thresholds = DEFAULT_THRESHOLDS[conditionType],
    readings = [],
    moodChecks = [],
    caregiverLogs = [],
    existingOpenAlerts = [],
    currentDateIst = getTodayIst(),
  } = input;

  const alertsToCreate: GeneratedAlert[] = [];

  // Helper to check if an open alert of this alert_type was already created today (IST)
  const isDuplicateToday = (alertType: string): boolean => {
    return existingOpenAlerts.some(
      (a) =>
        a.condition_type === conditionType &&
        a.alert_type === alertType &&
        a.status === "open" &&
        toIstDateString(a.created_at) === currentDateIst
    );
  };

  if (conditionType === "diabetes") {
    const t = { ...DEFAULT_THRESHOLDS.diabetes, ...thresholds };
    // Filter readings for diabetes glucose
    const glucoseReadings = readings
      .filter((r) =>
        ["glucose_fasting", "glucose_post_meal", "glucose_bedtime"].includes(r.reading_type)
      )
      .sort((a, b) => new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime());

    // 1. Inactivity check: no glucose logged for N days
    if (glucoseReadings.length === 0) {
      if (!isDuplicateToday("no_glucose_3d")) {
        alertsToCreate.push({
          patient_id: patientId,
          condition_type: "diabetes",
          severity: "warning",
          alert_type: "no_glucose_3d",
          message: `No blood glucose readings recorded in the last ${t.inactivityDaysWarning} days.`,
          status: "open",
        });
      }
    } else {
      const latestReading = glucoseReadings[0];
      const daysSince = daysAgoInIst(latestReading.recorded_at);
      if (daysSince >= t.inactivityDaysWarning && !isDuplicateToday("no_glucose_3d")) {
        alertsToCreate.push({
          patient_id: patientId,
          condition_type: "diabetes",
          severity: "warning",
          alert_type: "no_glucose_3d",
          message: `No blood glucose readings recorded in the last ${daysSince} days.`,
          status: "open",
        });
      }

      // Check the latest reading if it happened today
      if (toIstDateString(latestReading.recorded_at) === currentDateIst) {
        const val = latestReading.value;
        // Urgent low: < 70
        if (val < t.glucoseUrgentLow && !isDuplicateToday("glucose_urgent_low")) {
          alertsToCreate.push({
            patient_id: patientId,
            condition_type: "diabetes",
            severity: "urgent",
            alert_type: "glucose_urgent_low",
            message: `Urgent: Low blood glucose of ${val} mg/dL detected. Risk of hypoglycemia.`,
            related_reading_id: latestReading.id,
            status: "open",
          });
        }
        // Urgent high: > 250
        else if (val > t.glucoseUrgentHigh && !isDuplicateToday("glucose_urgent_high")) {
          alertsToCreate.push({
            patient_id: patientId,
            condition_type: "diabetes",
            severity: "urgent",
            alert_type: "glucose_urgent_high",
            message: `Urgent: Very high blood glucose of ${val} mg/dL detected.`,
            related_reading_id: latestReading.id,
            status: "open",
          });
        }
        // Fasting warning: fasting > 130
        else if (
          latestReading.reading_type === "glucose_fasting" &&
          val > t.glucoseFastingWarning &&
          !isDuplicateToday("glucose_fasting_warning")
        ) {
          alertsToCreate.push({
            patient_id: patientId,
            condition_type: "diabetes",
            severity: "warning",
            alert_type: "glucose_fasting_warning",
            message: `High fasting blood glucose: ${val} mg/dL (target <= ${t.glucoseFastingWarning} mg/dL).`,
            related_reading_id: latestReading.id,
            status: "open",
          });
        }
      }
    }
  }

  if (conditionType === "hypertension") {
    const t = { ...DEFAULT_THRESHOLDS.hypertension, ...thresholds };
    // Get systolic and diastolic readings
    const systolicReadings = readings
      .filter((r) => r.reading_type === "systolic")
      .sort((a, b) => new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime());
    const diastolicReadings = readings
      .filter((r) => r.reading_type === "diastolic")
      .sort((a, b) => new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime());

    // 1. Inactivity check: no BP for N days
    if (systolicReadings.length === 0) {
      if (!isDuplicateToday("no_bp_3d")) {
        alertsToCreate.push({
          patient_id: patientId,
          condition_type: "hypertension",
          severity: "warning",
          alert_type: "no_bp_3d",
          message: `No blood pressure readings recorded in the last ${t.inactivityDaysWarning} days.`,
          status: "open",
        });
      }
    } else {
      const latestSys = systolicReadings[0];
      const daysSince = daysAgoInIst(latestSys.recorded_at);
      if (daysSince >= t.inactivityDaysWarning && !isDuplicateToday("no_bp_3d")) {
        alertsToCreate.push({
          patient_id: patientId,
          condition_type: "hypertension",
          severity: "warning",
          alert_type: "no_bp_3d",
          message: `No blood pressure readings recorded in the last ${daysSince} days.`,
          status: "open",
        });
      }

      // Latest reading today evaluation
      if (toIstDateString(latestSys.recorded_at) === currentDateIst) {
        // Find matching diastolic for same timestamp or nearest
        const matchingDia = diastolicReadings.find(
          (d) => Math.abs(new Date(d.recorded_at).getTime() - new Date(latestSys.recorded_at).getTime()) < 60000
        ) || diastolicReadings[0];

        const sysVal = latestSys.value;
        const diaVal = matchingDia ? matchingDia.value : 0;

        // Urgent: sys >= 180 or dia >= 120
        if ((sysVal >= t.systolicUrgent || diaVal >= t.diastolicUrgent) && !isDuplicateToday("bp_urgent")) {
          alertsToCreate.push({
            patient_id: patientId,
            condition_type: "hypertension",
            severity: "urgent",
            alert_type: "bp_urgent",
            message: `Urgent: Critical blood pressure reading ${sysVal}/${diaVal} mmHg. Hypertensive crisis threshold.`,
            related_reading_id: latestSys.id,
            status: "open",
          });
        }
        // Warning: sys >= 140 or dia >= 90
        else if ((sysVal >= t.systolicWarning || diaVal >= t.diastolicWarning) && !isDuplicateToday("bp_warning")) {
          alertsToCreate.push({
            patient_id: patientId,
            condition_type: "hypertension",
            severity: "warning",
            alert_type: "bp_warning",
            message: `Elevated blood pressure: ${sysVal}/${diaVal} mmHg (threshold ${t.systolicWarning}/${t.diastolicWarning} mmHg).`,
            related_reading_id: latestSys.id,
            status: "open",
          });
        }

        // 3 consecutive high readings in a row
        if (systolicReadings.length >= t.consecutiveHighCount) {
          const recentSys = systolicReadings.slice(0, t.consecutiveHighCount);
          const allHigh = recentSys.every((r) => r.value >= t.systolicWarning);
          if (allHigh && !isDuplicateToday("bp_consecutive_high")) {
            alertsToCreate.push({
              patient_id: patientId,
              condition_type: "hypertension",
              severity: "warning",
              alert_type: "bp_consecutive_high",
              message: `Persistent high blood pressure: ${t.consecutiveHighCount} consecutive readings above ${t.systolicWarning} mmHg.`,
              related_reading_id: latestSys.id,
              status: "open",
            });
          }
        }
      }
    }
  }

  if (conditionType === "depression") {
    const t = { ...DEFAULT_THRESHOLDS.depression, ...thresholds };
    const sortedChecks = [...moodChecks].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    if (sortedChecks.length > 0) {
      const latestCheck = sortedChecks[0];

      // PART 4: DEPRESSION SAFETY RULE
      // If PHQ-9 question 9 (self-harm thoughts) is above zero: urgent alert immediately
      if (latestCheck.questionnaire === "phq9" && Array.isArray(latestCheck.answers)) {
        const q9Answer = latestCheck.answers[8] ?? 0; // Question 9 index 8
        if (q9Answer > 0 && !isDuplicateToday("phq9_self_harm")) {
          alertsToCreate.push({
            patient_id: patientId,
            condition_type: "depression",
            severity: "urgent",
            alert_type: "phq9_self_harm",
            message: `Urgent Safety Alert: Patient indicated thoughts of self-harm on PHQ-9 (Question 9 score ${q9Answer}). Immediate care team and caregiver contact required.`,
            status: "open",
          });
        }
      }

      // Check total score severity (applicable for PHQ-9)
      if (latestCheck.questionnaire === "phq9") {
        if (latestCheck.total_score >= t.phq9UrgentMin && !isDuplicateToday("phq9_severe")) {
          alertsToCreate.push({
            patient_id: patientId,
            condition_type: "depression",
            severity: "urgent",
            alert_type: "phq9_severe",
            message: `Urgent: Severe depression indicator on PHQ-9 (Total Score: ${latestCheck.total_score}/27).`,
            status: "open",
          });
        } else if (
          latestCheck.total_score >= t.phq9WarningMin &&
          latestCheck.total_score < t.phq9UrgentMin &&
          !isDuplicateToday("phq9_moderate")
        ) {
          alertsToCreate.push({
            patient_id: patientId,
            condition_type: "depression",
            severity: "warning",
            alert_type: "phq9_moderate",
            message: `Moderate depression indicator on PHQ-9 (Total Score: ${latestCheck.total_score}/27).`,
            status: "open",
          });
        }
      }

      // Score rising two checks in a row
      if (sortedChecks.length >= 3) {
        const [c0, c1, c2] = sortedChecks;
        if (c0.total_score > c1.total_score && c1.total_score > c2.total_score) {
          if (!isDuplicateToday("phq_score_rising")) {
            alertsToCreate.push({
              patient_id: patientId,
              condition_type: "depression",
              severity: "warning",
              alert_type: "phq_score_rising",
              message: `Worsening mood trend: PHQ scores have increased across the last 2 checks (${c2.total_score} -> ${c1.total_score} -> ${c0.total_score}).`,
              status: "open",
            });
          }
        }
      }
    }
  }

  if (conditionType === "dementia") {
    const t = { ...DEFAULT_THRESHOLDS.dementia, ...thresholds };
    const sortedLogs = [...caregiverLogs].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    if (sortedLogs.length > 0) {
      const latestLog = sortedLogs[0];

      // If logged today in IST
      if (toIstDateString(latestLog.created_at) === currentDateIst) {
        // High confusion level >= 4
        if (latestLog.confusion_level >= t.confusionWarningThreshold && !isDuplicateToday("confusion_high")) {
          alertsToCreate.push({
            patient_id: patientId,
            condition_type: "dementia",
            severity: "warning",
            alert_type: "confusion_high",
            message: `High confusion level (${latestLog.confusion_level}/5) reported by caregiver.`,
            status: "open",
          });
        }

        // Agitation or wandering flagged
        if (latestLog.agitation_or_wandering && !isDuplicateToday("agitation_wandering")) {
          alertsToCreate.push({
            patient_id: patientId,
            condition_type: "dementia",
            severity: "warning",
            alert_type: "agitation_wandering",
            message: `Agitation or wandering behavior reported by caregiver.`,
            status: "open",
          });
        }

        // Medicine not confirmed by caregiver today
        if (!latestLog.medicine_confirmed && !isDuplicateToday("dementia_meds_unconfirmed")) {
          alertsToCreate.push({
            patient_id: patientId,
            condition_type: "dementia",
            severity: "warning",
            alert_type: "dementia_meds_unconfirmed",
            message: `Daily medication adherence was not confirmed by caregiver today.`,
            status: "open",
          });
        }
      }
    }
  }

  return alertsToCreate;
}
