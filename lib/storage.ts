// lib/storage.ts — localStorage CRUD layer

import type { Patient, Medication, VitalReading } from "@/types";

const PATIENTS_KEY = "raksha_patients";
const MEDS_KEY = "raksha_medications";
const VITALS_KEY = "raksha_vitals";

const SEED_PATIENTS: Patient[] = [
  {
    id: "pat-1",
    name: "Kamala Devi",
    age: 72,
    phone: "+91 94400 12345",
    conditions: ["Type 2 Diabetes", "Hypertension"],
    hasDiabetes: true,
    hasHypertension: true,
    createdAt: new Date(Date.now() - 14 * 86400000).toISOString(),
  },
  {
    id: "pat-2",
    name: "Rajesh Sharma",
    age: 58,
    phone: "+91 99001 56789",
    conditions: ["Heart Failure", "Hypertension"],
    hasDiabetes: false,
    hasHypertension: true,
    createdAt: new Date(Date.now() - 10 * 86400000).toISOString(),
  },
  {
    id: "pat-3",
    name: "Sunita Patel",
    age: 65,
    phone: "+91 98200 11223",
    conditions: ["Hypothyroidism", "Osteoporosis"],
    hasDiabetes: false,
    hasHypertension: false,
    createdAt: new Date(Date.now() - 5 * 86400000).toISOString(),
  },
];

const SEED_MEDS: Medication[] = [
  {
    id: "med-1",
    patientId: "pat-1",
    name: "Metformin",
    dosage: "500",
    unit: "mg",
    schedule: "Twice daily",
    notes: "Take with breakfast and dinner. Avoid grapefruit.",
    createdAt: new Date(Date.now() - 14 * 86400000).toISOString(),
  },
  {
    id: "med-2",
    patientId: "pat-1",
    name: "Amlodipine",
    dosage: "5",
    unit: "mg",
    schedule: "Once daily (morning)",
    notes: "Take every morning with a full glass of water.",
    createdAt: new Date(Date.now() - 14 * 86400000).toISOString(),
  },
  {
    id: "med-3",
    patientId: "pat-2",
    name: "Carvedilol",
    dosage: "12.5",
    unit: "mg",
    schedule: "Twice daily",
    notes: "Take with food.",
    createdAt: new Date(Date.now() - 10 * 86400000).toISOString(),
  },
  {
    id: "med-4",
    patientId: "pat-2",
    name: "Furosemide",
    dosage: "40",
    unit: "mg",
    schedule: "Once daily (morning)",
    notes: "Drink adequate fluids during daytime.",
    createdAt: new Date(Date.now() - 10 * 86400000).toISOString(),
  },
  {
    id: "med-5",
    patientId: "pat-3",
    name: "Levothyroxine",
    dosage: "50",
    unit: "mcg",
    schedule: "Once daily (morning)",
    notes: "Take 30 mins before breakfast on an empty stomach.",
    createdAt: new Date(Date.now() - 5 * 86400000).toISOString(),
  },
];

function generateSeedVitals(): VitalReading[] {
  const list: VitalReading[] = [];
  const now = Date.now();

  // pat-1: 14 days of Blood Sugar + Blood Pressure (strictly in the past)
  const pat1Sugar = [135, 142, 128, 155, 146, 130, 160, 138, 126, 142, 150, 132, 128, 136];
  const pat1BP = [
    [128, 82], [134, 84], [124, 80], [138, 88], [130, 84], [122, 78], [142, 86],
    [128, 82], [132, 84], [126, 80], [136, 85], [120, 78], [130, 82], [126, 80]
  ];

  for (let i = 13; i >= 0; i--) {
    // i=0 is 3 hours ago, i=1 is 1 day ago, etc.
    const offsetMs = i === 0 ? 3 * 3600000 : (i * 86400000 + 2 * 3600000);
    const time = new Date(now - offsetMs).toISOString();
    const sugarVal = pat1Sugar[13 - i];
    list.push({
      id: `vit-p1-bs-${i}`,
      patientId: "pat-1",
      type: "blood_sugar",
      value: sugarVal,
      measuredAt: time,
      notes: i === 0 ? "Fasting reading" : undefined,
    });

    const [sys, dia] = pat1BP[13 - i];
    list.push({
      id: `vit-p1-bp-${i}`,
      patientId: "pat-1",
      type: "blood_pressure",
      systolic: sys,
      diastolic: dia,
      measuredAt: new Date(now - offsetMs - 900000).toISOString(),
      notes: i === 0 ? "Morning resting check" : undefined,
    });
  }

  // pat-2: 10 days of Blood Pressure + some Blood Sugar
  const pat2BP = [
    [136, 88], [140, 90], [132, 84], [138, 86], [142, 92], [135, 86], [130, 82], [138, 88], [134, 85], [132, 84]
  ];
  for (let i = 9; i >= 0; i--) {
    const offsetMs = i === 0 ? 4 * 3600000 : (i * 86400000 + 3 * 3600000);
    const [sys, dia] = pat2BP[9 - i];
    list.push({
      id: `vit-p2-bp-${i}`,
      patientId: "pat-2",
      type: "blood_pressure",
      systolic: sys,
      diastolic: dia,
      measuredAt: new Date(now - offsetMs).toISOString(),
      notes: "Post morning medication",
    });
  }
  list.push({
    id: "vit-p2-bs-0",
    patientId: "pat-2",
    type: "blood_sugar",
    value: 104,
    measuredAt: new Date(now - 86400000).toISOString(),
    notes: "Routine check",
  });

  // pat-3: normal baseline
  list.push({
    id: "vit-p3-bs-0",
    patientId: "pat-3",
    type: "blood_sugar",
    value: 96,
    measuredAt: new Date(now - 2 * 86400000).toISOString(),
    notes: "Fasting",
  });
  list.push({
    id: "vit-p3-bp-0",
    patientId: "pat-3",
    type: "blood_pressure",
    systolic: 116,
    diastolic: 76,
    measuredAt: new Date(now - 2 * 86400000).toISOString(),
    notes: "Resting",
  });

  return list;
}

const SEED_VITALS: VitalReading[] = generateSeedVitals();

// ── utils ────────────────────────────────────────────────────────────────────
function uid(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJSON<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore quota errors
  }
}

// ── Patients ─────────────────────────────────────────────────────────────────
export function getPatients(): Patient[] {
  if (typeof window === "undefined") return SEED_PATIENTS;
  const raw = localStorage.getItem(PATIENTS_KEY);
  if (!raw) {
    writeJSON(PATIENTS_KEY, SEED_PATIENTS);
    if (!localStorage.getItem(MEDS_KEY)) {
      writeJSON(MEDS_KEY, SEED_MEDS);
    }
    if (!localStorage.getItem(VITALS_KEY)) {
      writeJSON(VITALS_KEY, SEED_VITALS);
    }
    return SEED_PATIENTS;
  }
  return readJSON<Patient[]>(PATIENTS_KEY, SEED_PATIENTS);
}

export function getPatientById(id: string): Patient | undefined {
  return getPatients().find((p) => p.id === id);
}

export function addPatient(data: Omit<Patient, "id" | "createdAt">): Patient {
  const patient: Patient = { ...data, id: uid(), createdAt: new Date().toISOString() };
  const all = getPatients();
  writeJSON(PATIENTS_KEY, [...all, patient]);
  return patient;
}

export function updatePatient(id: string, updates: Partial<Patient>): Patient | undefined {
  const all = getPatients();
  let updated: Patient | undefined;
  const next = all.map((p) => {
    if (p.id === id) {
      updated = { ...p, ...updates };
      return updated;
    }
    return p;
  });
  writeJSON(PATIENTS_KEY, next);
  return updated;
}

export function deletePatient(id: string): void {
  writeJSON(PATIENTS_KEY, getPatients().filter((p) => p.id !== id));
  // cascade-delete their meds and vitals
  writeJSON(MEDS_KEY, getMedications().filter((m) => m.patientId !== id));
  writeJSON(VITALS_KEY, getVitals().filter((v) => v.patientId !== id));
}

// ── Medications ───────────────────────────────────────────────────────────────
export function getMedications(): Medication[] {
  if (typeof window === "undefined") return SEED_MEDS;
  const raw = localStorage.getItem(MEDS_KEY);
  if (!raw) {
    writeJSON(MEDS_KEY, SEED_MEDS);
    return SEED_MEDS;
  }
  return readJSON<Medication[]>(MEDS_KEY, SEED_MEDS);
}

export function getMedsByPatient(patientId: string): Medication[] {
  return getMedications().filter((m) => m.patientId === patientId);
}

export function addMedication(data: Omit<Medication, "id" | "createdAt">): Medication {
  const med: Medication = { ...data, id: uid(), createdAt: new Date().toISOString() };
  writeJSON(MEDS_KEY, [...getMedications(), med]);
  return med;
}

export function deleteMedication(id: string): void {
  writeJSON(MEDS_KEY, getMedications().filter((m) => m.id !== id));
}

// ── Vitals ───────────────────────────────────────────────────────────────────
export function getVitals(): VitalReading[] {
  if (typeof window === "undefined") return SEED_VITALS;
  const raw = localStorage.getItem(VITALS_KEY);
  if (!raw) {
    writeJSON(VITALS_KEY, SEED_VITALS);
    return SEED_VITALS;
  }
  const vitals = readJSON<VitalReading[]>(VITALS_KEY, SEED_VITALS);
  // Auto-sanitize any seed items that were generated in the future
  const now = Date.now();
  let changed = false;
  const sanitized = vitals.map((v) => {
    if (v.id.startsWith("vit-p") && new Date(v.measuredAt).getTime() > now) {
      changed = true;
      return { ...v, measuredAt: new Date(now - 3 * 3600000).toISOString() };
    }
    return v;
  });
  if (changed) {
    writeJSON(VITALS_KEY, sanitized);
  }
  return sanitized;
}

export function getVitalsByPatient(patientId: string): VitalReading[] {
  return getVitals()
    .filter((v) => v.patientId === patientId)
    .sort((a, b) => new Date(b.measuredAt).getTime() - new Date(a.measuredAt).getTime());
}

export function getLatestVital(
  patientId: string,
  type: "blood_sugar" | "blood_pressure"
): VitalReading | undefined {
  const patientVitals = getVitalsByPatient(patientId);
  return patientVitals.find((v) => v.type === type);
}

export function getLatestVitalsSummary(patientId: string): {
  sugar?: VitalReading;
  bp?: VitalReading;
} {
  return {
    sugar: getLatestVital(patientId, "blood_sugar"),
    bp: getLatestVital(patientId, "blood_pressure"),
  };
}

export function getVitalsHistory(
  patientId: string,
  days: number,
  type?: "blood_sugar" | "blood_pressure"
): VitalReading[] {
  const threshold = Date.now() - days * 86400000;
  return getVitals()
    .filter((v) => {
      if (v.patientId !== patientId) return false;
      if (type && v.type !== type) return false;
      return new Date(v.measuredAt).getTime() >= threshold;
    })
    .sort((a, b) => new Date(a.measuredAt).getTime() - new Date(b.measuredAt).getTime());
}

export function addVitalReading(data: Omit<VitalReading, "id">): VitalReading {
  const reading: VitalReading = { ...data, id: uid() };
  const all = getVitals();
  writeJSON(VITALS_KEY, [reading, ...all]);
  return reading;
}

export function deleteVitalReading(id: string): void {
  writeJSON(VITALS_KEY, getVitals().filter((v) => v.id !== id));
}

// ── Vitals Range Evaluation Helpers ──────────────────────────────────────────
export function getBloodSugarStatus(val?: number): {
  label: "Low" | "Normal" | "High" | "Unknown";
  color: string;
  bg: string;
  border: string;
} {
  if (typeof val !== "number" || isNaN(val)) {
    return { label: "Unknown", color: "#6B7280", bg: "#F3F4F6", border: "#E5E7EB" };
  }
  if (val < 70) {
    return { label: "Low", color: "#D97706", bg: "#FEF3C7", border: "#FDE68A" };
  }
  if (val <= 140) {
    return { label: "Normal", color: "#059669", bg: "#ECFDF5", border: "#A7F3D0" };
  }
  return { label: "High", color: "#DC2626", bg: "#FEE2E2", border: "#FECACA" };
}

export function getBloodPressureStatus(
  systolic?: number,
  diastolic?: number
): {
  label: "Normal" | "Elevated" | "High" | "Unknown";
  color: string;
  bg: string;
  border: string;
} {
  if (
    typeof systolic !== "number" ||
    typeof diastolic !== "number" ||
    isNaN(systolic) ||
    isNaN(diastolic)
  ) {
    return { label: "Unknown", color: "#6B7280", bg: "#F3F4F6", border: "#E5E7EB" };
  }
  if (systolic < 120 && diastolic < 80) {
    return { label: "Normal", color: "#059669", bg: "#ECFDF5", border: "#A7F3D0" };
  }
  if (systolic < 130 && diastolic < 80) {
    return { label: "Elevated", color: "#D97706", bg: "#FEF3C7", border: "#FDE68A" };
  }
  return { label: "High", color: "#DC2626", bg: "#FEE2E2", border: "#FECACA" };
}
