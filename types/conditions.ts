// types/conditions.ts
// Shared types for condition-aware care platform: diabetes, hypertension, dementia, depression

export type ConditionType = "diabetes" | "hypertension" | "dementia" | "depression";

export const CONDITION_TYPES: ConditionType[] = [
  "diabetes",
  "hypertension",
  "dementia",
  "depression",
];

export const CONDITION_LABELS: Record<ConditionType, string> = {
  diabetes: "Diabetes",
  hypertension: "Hypertension (BP)",
  dementia: "Dementia",
  depression: "Depression",
};

export type ReadingType =
  // Diabetes
  | "glucose_fasting"
  | "glucose_post_meal"
  | "glucose_bedtime"
  | "hba1c"
  // Hypertension
  | "systolic"
  | "diastolic"
  | "pulse"
  // Dementia
  | "confusion_level"
  | "sleep_hours"
  | "appetite"
  | "agitation"
  // Depression
  | "mood_score";

export type ReadingSource = "patient" | "caregiver" | "call" | "clinician";

export type AlertSeverity = "info" | "warning" | "urgent";

export type AlertStatus = "open" | "acknowledged" | "resolved";

export interface PatientCondition {
  id: string;
  patient_id: string;
  condition_type: ConditionType;
  diagnosed_on?: string | null;
  is_active: boolean;
  created_at: string;
}

export interface Reading {
  id: string;
  patient_id: string;
  condition_type: ConditionType;
  reading_type: ReadingType;
  value: number;
  unit: string;
  note?: string | null;
  source: ReadingSource;
  recorded_at: string;
  created_at: string;
}

export interface CaregiverLog {
  id: string;
  patient_id: string;
  logged_by: string;
  confusion_level: number; // 1-5
  sleep_quality: number; // 1-5
  appetite: number; // 1-5
  agitation_or_wandering: boolean;
  medicine_confirmed: boolean;
  notes?: string | null;
  created_at: string;
}

export interface MoodCheck {
  id: string;
  patient_id: string;
  questionnaire: "phq2" | "phq9";
  answers: number[]; // e.g. [0, 1, 2, ...]
  total_score: number;
  created_at: string;
}

export interface ConditionAlert {
  id: string;
  patient_id: string;
  condition_type: ConditionType;
  severity: AlertSeverity;
  message: string;
  alert_type?: string;
  related_reading_id?: string | null;
  status: AlertStatus;
  created_at: string;
  acknowledged_at?: string | null;
  // Join fields for care team dashboard
  patient_name?: string;
  patient_phone?: string;
}

// ── Thresholds ─────────────────────────────────────────────────────────────────

export interface DiabetesThresholds {
  glucoseUrgentLow: number; // < 70 mg/dL (urgent)
  glucoseFastingWarning: number; // > 130 mg/dL (warning)
  glucoseUrgentHigh: number; // > 250 mg/dL (urgent)
  inactivityDaysWarning: number; // 3 days
}

export interface HypertensionThresholds {
  systolicWarning: number; // >= 140 mmHg
  diastolicWarning: number; // >= 90 mmHg
  systolicUrgent: number; // >= 180 mmHg
  diastolicUrgent: number; // >= 120 mmHg
  consecutiveHighCount: number; // 3
  inactivityDaysWarning: number; // 3 days
}

export interface DepressionThresholds {
  phq9WarningMin: number; // 10
  phq9UrgentMin: number; // 15
  risingChecksCount: number; // 2
  selfHarmUrgent: boolean; // true
}

export interface DementiaThresholds {
  confusionWarningThreshold: number; // 4
  flagAgitationWandering: boolean; // true
  dailyMedicineConfirmationRequired: boolean; // true
}

export type ConditionThresholds =
  | DiabetesThresholds
  | HypertensionThresholds
  | DepressionThresholds
  | DementiaThresholds;

export interface CarePlan {
  id: string;
  patient_id: string;
  condition_type: ConditionType;
  thresholds: Record<string, any>;
  updated_by: string;
  updated_at: string;
}

export const DEFAULT_THRESHOLDS: Record<ConditionType, Record<string, any>> = {
  diabetes: {
    glucoseUrgentLow: 70,
    glucoseFastingWarning: 130,
    glucoseUrgentHigh: 250,
    inactivityDaysWarning: 3,
  },
  hypertension: {
    systolicWarning: 140,
    diastolicWarning: 90,
    systolicUrgent: 180,
    diastolicUrgent: 120,
    consecutiveHighCount: 3,
    inactivityDaysWarning: 3,
  },
  depression: {
    phq9WarningMin: 10,
    phq9UrgentMin: 15,
    risingChecksCount: 2,
    selfHarmUrgent: true,
  },
  dementia: {
    confusionWarningThreshold: 4,
    flagAgitationWandering: true,
    dailyMedicineConfirmationRequired: true,
  },
};

export const THRESHOLD_UI_LABEL = "Set by the care team. Defaults shown for demo.";
export const CLINICAL_DISCLAIMER =
  "Raksha flags and notifies only. It must never diagnose, recommend a medicine or dose, or change treatment.";

// Placeholder mental health helpline number - MUST VERIFY THE CORRECT NUMBER BEFORE DEMO
// Tele-MANAS (Govt of India, toll-free 24x7) is 14416 / Vandrevala Foundation: +91 9999 666 555
export const HELPLINE_NUMBER = "14416";
