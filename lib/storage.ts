// lib/storage.ts — localStorage CRUD layer

import type {
  Patient,
  Medication,
  VitalReading,
  ScheduledDose,
  DoseStatus,
  DosePeriod,
  AdherenceStats,
  CaregiverContact,
  CommunicationLog,
} from "@/types";

const PATIENTS_KEY = "raksha_patients";
const MEDS_KEY = "raksha_medications";
const VITALS_KEY = "raksha_vitals";
const DOSES_KEY = "raksha_today_doses";
const COMMUNICATIONS_KEY = "raksha_communications";

const SEED_PATIENTS: Patient[] = [
  {
    id: "pat-1",
    name: "Kamala Devi",
    age: 72,
    phone: "+91 7406842246",
    conditions: ["Type 2 Diabetes", "Hypertension"],
    hasDiabetes: true,
    hasHypertension: true,
    caregivers: [
      { name: "Anil Devi", relation: "Son", phone: "+91 8073909604", isPrimary: true },
      { name: "Dr. Ramesh", relation: "Primary Physician", phone: "+91 99000 54321" },
    ],
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
    caregivers: [
      { name: "Priya Sharma", relation: "Wife", phone: "+91 88002 11111", isPrimary: true },
    ],
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
    caregivers: [
      { name: "Aakash Patel", relation: "Son", phone: "+91 98200 44556", isPrimary: true },
    ],
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
  const loaded = readJSON<Patient[]>(PATIENTS_KEY, SEED_PATIENTS);
  let changed = false;
  const withCaregivers = loaded.map((p) => {
    if (!p.caregivers || p.caregivers.length === 0) {
      changed = true;
      const seedMatch = SEED_PATIENTS.find((s) => s.id === p.id);
      return {
        ...p,
        caregivers: seedMatch?.caregivers ?? [
          { name: "Primary Caregiver", relation: "Family", phone: "+91 8073909604", isPrimary: true },
        ],
      };
    }

    // Fix any caregiver whose phone was set to patient's phone (7406842246)
    const updatedCaregivers = p.caregivers.map((c) => {
      const cClean = (c.phone || "").replace(/\D/g, "");
      const pClean = (p.phone || "").replace(/\D/g, "");
      if (!c.phone || cClean.endsWith("7406842246") || (pClean && cClean === pClean)) {
        changed = true;
        return { ...c, phone: "+91 8073909604" };
      }
      return c;
    });

    return {
      ...p,
      caregivers: updatedCaregivers,
    };
  });
  if (changed) {
    writeJSON(PATIENTS_KEY, withCaregivers);
  }
  return withCaregivers;
}

// ── Communications (SMS / Voice Call Logs) ──────────────────────────────────
export function getCommunications(patientId?: string): CommunicationLog[] {
  if (typeof window === "undefined") return [];
  const list = readJSON<CommunicationLog[]>(COMMUNICATIONS_KEY, []);
  if (patientId) {
    return list.filter((c) => c.patientId === patientId);
  }
  return list;
}

export function logCommunication(
  entry: Omit<CommunicationLog, "id" | "timestamp"> & { id?: string; timestamp?: string }
): CommunicationLog {
  const all = getCommunications();
  const newLog: CommunicationLog = {
    ...entry,
    id: entry.id ?? uid(),
    timestamp: entry.timestamp ?? new Date().toISOString(),
  };
  writeJSON(COMMUNICATIONS_KEY, [newLog, ...all]);
  return newLog;
}

export function getLastSms(patientId: string): CommunicationLog | undefined {
  const patientLogs = getCommunications(patientId);
  return patientLogs.find((c) => c.type === "sms" && c.status === "sent");
}

export function getPrimaryCaregiver(patient: Patient): CaregiverContact | undefined {
  if (!patient.caregivers || patient.caregivers.length === 0) return undefined;
  return patient.caregivers.find((c) => c.isPrimary) || patient.caregivers[0];
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

// ── Today's Scheduled Doses ──────────────────────────────────────────────────
export function generateSeedDoses(): ScheduledDose[] {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const todayStr = `${year}-${month}-${day}`;

  return [
    // 08:00 AM — 3 Tablets sharing the Morning Slot
    {
      id: "dose-1",
      patientId: "pat-1",
      medicineId: "med-1",
      medicineName: "Metformin HCl",
      dosage: "500 mg",
      instructions: "Take with breakfast • Swallow whole with water",
      timeSlot: "08:00 AM",
      scheduledTime: `${todayStr}T08:00:00`,
      originalTime: `${todayStr}T08:00:00`,
      status: "pending",
      period: "morning",
      color: "#00C896", // Soft Emerald Teal
      shape: "round",
    },
    {
      id: "dose-2",
      patientId: "pat-1",
      medicineId: "med-2",
      medicineName: "Amlodipine Besylate",
      dosage: "5 mg",
      instructions: "Hypertension • Drink with full glass of water",
      timeSlot: "08:00 AM",
      scheduledTime: `${todayStr}T08:00:00`,
      originalTime: `${todayStr}T08:00:00`,
      status: "pending",
      period: "morning",
      color: "#2563EB", // Sapphire Blue
      shape: "oval",
    },
    {
      id: "dose-3",
      patientId: "pat-1",
      medicineId: "med-aspirin",
      medicineName: "Aspirin Cardio",
      dosage: "81 mg",
      instructions: "Heart health • Take right after breakfast meal",
      timeSlot: "08:00 AM",
      scheduledTime: `${todayStr}T08:00:00`,
      originalTime: `${todayStr}T08:00:00`,
      status: "pending",
      period: "morning",
      color: "#D97706", // Warm Amber
      shape: "capsule",
    },

    // 01:00 PM — 2 Tablets sharing the Afternoon Slot
    {
      id: "dose-4",
      patientId: "pat-1",
      medicineId: "med-1-midday",
      medicineName: "Metformin HCl",
      dosage: "500 mg",
      instructions: "Midday dose • Take midway through lunch",
      timeSlot: "01:00 PM",
      scheduledTime: `${todayStr}T13:00:00`,
      originalTime: `${todayStr}T13:00:00`,
      status: "pending",
      period: "afternoon",
      color: "#00C896", // Soft Emerald Teal
      shape: "round",
    },
    {
      id: "dose-5",
      patientId: "pat-1",
      medicineId: "med-vitd",
      medicineName: "Vitamin D3 & Calcium",
      dosage: "1000 IU",
      instructions: "Chewable tablet for bone strength",
      timeSlot: "01:00 PM",
      scheduledTime: `${todayStr}T13:00:00`,
      originalTime: `${todayStr}T13:00:00`,
      status: "pending",
      period: "afternoon",
      color: "#059669", // Rich Green
      shape: "round",
    },

    // 07:30 PM — Evening Slot
    {
      id: "dose-6",
      patientId: "pat-1",
      medicineId: "med-losartan",
      medicineName: "Losartan Potassium",
      dosage: "50 mg",
      instructions: "Evening BP management • Take with dinner",
      timeSlot: "07:30 PM",
      scheduledTime: `${todayStr}T19:30:00`,
      originalTime: `${todayStr}T19:30:00`,
      status: "pending",
      period: "evening",
      color: "#7C3AED", // Royal Purple
      shape: "oval",
    },

    // 10:00 PM — Night Slot
    {
      id: "dose-7",
      patientId: "pat-1",
      medicineId: "med-atorva",
      medicineName: "Atorvastatin Calcium",
      dosage: "20 mg",
      instructions: "Cholesterol control • Take right before sleep",
      timeSlot: "10:00 PM",
      scheduledTime: `${todayStr}T22:00:00`,
      originalTime: `${todayStr}T22:00:00`,
      status: "pending",
      period: "night",
      color: "#E11D48", // Rose Crimson
      shape: "capsule",
    },
  ];
}

const SEED_DOSES = generateSeedDoses();

export function getTodayDoses(patientId?: string): ScheduledDose[] {
  if (typeof window === "undefined") return SEED_DOSES;
  const raw = localStorage.getItem(DOSES_KEY);
  let doses: ScheduledDose[];
  if (!raw) {
    doses = generateSeedDoses();
    writeJSON(DOSES_KEY, doses);
  } else {
    try {
      doses = JSON.parse(raw) as ScheduledDose[];
    } catch {
      doses = generateSeedDoses();
      writeJSON(DOSES_KEY, doses);
    }
  }

  if (patientId) {
    return doses.filter((d) => d.patientId === patientId);
  }
  return doses;
}

export function saveTodayDoses(doses: ScheduledDose[]): void {
  writeJSON(DOSES_KEY, doses);
}

export function updateDoseStatus(
  id: string,
  status: DoseStatus,
  extra?: { takenAt?: string; notes?: string }
): ScheduledDose | undefined {
  const doses = getTodayDoses();
  const idx = doses.findIndex((d) => d.id === id);
  if (idx === -1) return undefined;

  const current = doses[idx];
  const updated: ScheduledDose = {
    ...current,
    status,
    actualTakenTime:
      status === "taken"
        ? extra?.takenAt ?? new Date().toISOString()
        : current.actualTakenTime,
    notes: extra?.notes ?? current.notes,
  };

  doses[idx] = updated;
  saveTodayDoses(doses);
  return updated;
}

export function snoozeDose(id: string, minutes: number): ScheduledDose | undefined {
  const doses = getTodayDoses();
  const idx = doses.findIndex((d) => d.id === id);
  if (idx === -1) return undefined;

  const current = doses[idx];
  const baseDate = current.scheduledTime ? new Date(current.scheduledTime) : new Date();
  const targetDate = new Date(baseDate.getTime() + minutes * 60000);

  // Format new time slot e.g. "08:30 AM"
  const hour = targetDate.getHours();
  const mins = String(targetDate.getMinutes()).padStart(2, "0");
  const periodStr = hour >= 12 ? "PM" : "AM";
  const standardHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  const newTimeSlot = `${String(standardHour).padStart(2, "0")}:${mins} ${periodStr}`;

  // Determine period
  let period: DosePeriod = "morning";
  if (hour >= 5 && hour < 12) period = "morning";
  else if (hour >= 12 && hour < 17) period = "afternoon";
  else if (hour >= 17 && hour < 21) period = "evening";
  else period = "night";

  const updated: ScheduledDose = {
    ...current,
    status: "snoozed",
    timeSlot: newTimeSlot,
    scheduledTime: targetDate.toISOString(),
    period,
  };

  doses[idx] = updated;
  saveTodayDoses(doses);
  return updated;
}

export function undoDose(id: string): ScheduledDose | undefined {
  const doses = getTodayDoses();
  const idx = doses.findIndex((d) => d.id === id);
  if (idx === -1) return undefined;

  const current = doses[idx];
  const origDate = new Date(current.originalTime);
  const hour = origDate.getHours();
  const mins = String(origDate.getMinutes()).padStart(2, "0");
  const periodStr = hour >= 12 ? "PM" : "AM";
  const standardHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  const originalTimeSlot = `${String(standardHour).padStart(2, "0")}:${mins} ${periodStr}`;

  let period: DosePeriod = "morning";
  if (hour >= 5 && hour < 12) period = "morning";
  else if (hour >= 12 && hour < 17) period = "afternoon";
  else if (hour >= 17 && hour < 21) period = "evening";
  else period = "night";

  const updated: ScheduledDose = {
    ...current,
    status: "pending",
    timeSlot: originalTimeSlot,
    scheduledTime: current.originalTime,
    actualTakenTime: undefined,
    period,
  };

  doses[idx] = updated;
  saveTodayDoses(doses);
  return updated;
}

export function resetTodayDoses(): ScheduledDose[] {
  const fresh = generateSeedDoses();
  writeJSON(DOSES_KEY, fresh);
  return fresh;
}

export function calculateAdherenceStats(doses: ScheduledDose[]): AdherenceStats {
  const totalDoses = doses.length;
  const takenCount = doses.filter((d) => d.status === "taken").length;
  const pendingCount = doses.filter((d) => d.status === "pending").length;
  const snoozedCount = doses.filter((d) => d.status === "snoozed").length;
  const skippedCount = doses.filter((d) => d.status === "skipped").length;
  const missedCount = doses.filter((d) => d.status === "missed").length;

  const resolved = takenCount + skippedCount + missedCount;
  let adherenceRate = 100;
  if (resolved > 0) {
    adherenceRate = Math.round((takenCount / resolved) * 100);
  } else if (totalDoses > 0) {
    adherenceRate = Math.round((takenCount / totalDoses) * 100);
  }

  // Base streak is 7 days, if all doses are taken increment to 8
  const streakDays = totalDoses > 0 && doses.every((d) => d.status === "taken") ? 8 : 7;

  return {
    totalDoses,
    takenCount,
    pendingCount,
    snoozedCount,
    skippedCount,
    missedCount,
    adherenceRate,
    streakDays,
  };
}
