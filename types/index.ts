// types/index.ts

export interface Patient {
  id: string;
  name: string;
  age: number | null;
  phone: string;
  conditions: string[];
  hasDiabetes?: boolean;
  hasHypertension?: boolean;
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

