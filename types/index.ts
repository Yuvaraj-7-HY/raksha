// types/index.ts

export interface CaregiverContact {
  id?: string;
  name: string;
  relation: string;
  phone: string;
  isPrimary?: boolean;
}

export interface CommunicationLog {
  id: string;
  patientId: string;
  type: "sms" | "call";
  to: string;
  recipientName: string;
  message?: string;
  timestamp: string; // ISO
  status: "sent" | "failed";
  sid?: string;
  error?: string;
}

export interface Patient {
  id: string;
  name: string;
  age: number | null;
  phone: string;
  conditions: string[];
  hasDiabetes?: boolean;
  hasHypertension?: boolean;
  isDeaf?: boolean;
  deafNotificationChannel?: "both" | "sms" | "telegram";
  telegramChatId?: string;
  caregivers?: CaregiverContact[];
  createdAt: string; // ISO
}

export interface Medication {
  id: string;
  patientId: string;
  name: string;
  dosage: string;
  unit: string;
  schedule: string;
  notes: string;
  createdAt: string; // ISO
}

export interface VitalReading {
  id: string;
  patientId: string;
  type: "blood_sugar" | "blood_pressure";
  value?: number; // for blood sugar in mg/dL
  systolic?: number; // for blood pressure in mmHg
  diastolic?: number; // for blood pressure in mmHg
  measuredAt: string; // ISO timestamp
  notes?: string;
}

export type DoseStatus = "pending" | "taken" | "snoozed" | "skipped" | "missed";
export type DosePeriod = "morning" | "afternoon" | "evening" | "night";
export type MedicineShape = "round" | "oval" | "capsule";

export interface ScheduledDose {
  id: string;
  patientId: string;
  medicineId: string;
  medicineName: string;
  dosage: string;
  instructions: string;
  timeSlot: string; // e.g. "08:00 AM"
  scheduledTime: string; // ISO or standard time string
  originalTime: string;
  actualTakenTime?: string; // ISO timestamp when taken
  status: DoseStatus;
  period: DosePeriod;
  color: string; // Hex color e.g. "#00C896"
  shape: MedicineShape;
  notes?: string;
}

export interface AdherenceStats {
  totalDoses: number;
  takenCount: number;
  pendingCount: number;
  snoozedCount: number;
  skippedCount: number;
  missedCount: number;
  adherenceRate: number; // 0 - 100
  streakDays: number;
}

