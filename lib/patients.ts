// lib/patients.ts — Types + dummy data for the Care Team Dashboard

export type RiskLevel = "high" | "medium" | "low";

export interface DoseLog {
  id: string;
  medicine: string;
  scheduledAt: string;
  takenAt: string | null;
  status: "taken" | "missed" | "late";
}

export interface CaregiverContact {
  name: string;
  relation: string;
  phone: string;
}

export interface EscalationLog {
  id: string;
  patientId: string;
  type: "sms" | "call" | "family_alert";
  sentAt: string;
  status: "delivered" | "failed" | "pending";
  note: string;
}

export interface Patient {
  id: string;
  name: string;
  age: number;
  phone: string;
  conditions: string[];
  riskLevel: RiskLevel;
  adherence7d: number;
  adherence30d: number;
  streak: number;
  missedDoses30d: number;
  lastActivity: string;
  doseLogs: DoseLog[];
  caregivers: CaregiverContact[];
  notes: string;
  chartData: { day: string; pct: number }[];
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

function chart(pattern: number[]): { day: string; pct: number }[] {
  return pattern.map((pct, i) => ({
    day: new Date(Date.now() - (13 - i) * 86400000).toLocaleDateString("en-IN", { weekday: "short" }),
    pct,
  }));
}

export const PATIENTS: Patient[] = [
  {
    id: "p1",
    name: "Kamala Devi",
    age: 72,
    phone: "+91 94400 12345",
    conditions: ["Type 2 Diabetes", "Hypertension"],
    riskLevel: "high",
    adherence7d: 43,
    adherence30d: 51,
    streak: 0,
    missedDoses30d: 18,
    lastActivity: daysAgo(3),
    notes: "Patient tends to skip evening doses. Family lives far. Consider morning-only schedule.",
    caregivers: [
      { name: "Ravi Kumar", relation: "Son", phone: "+91 98765 43210" },
      { name: "Dr. Nair", relation: "Primary Physician", phone: "+91 80001 00000" },
    ],
    chartData: chart([80, 40, 20, 60, 0, 0, 40, 0, 60, 0, 80, 0, 40, 0]),
    doseLogs: [
      { id: "d1", medicine: "Metformin 500mg", scheduledAt: daysAgo(0), takenAt: null, status: "missed" },
      { id: "d2", medicine: "Amlodipine 5mg", scheduledAt: daysAgo(1), takenAt: null, status: "missed" },
      { id: "d3", medicine: "Metformin 500mg", scheduledAt: daysAgo(2), takenAt: daysAgo(2), status: "late" },
      { id: "d4", medicine: "Glipizide 5mg", scheduledAt: daysAgo(2), takenAt: null, status: "missed" },
      { id: "d5", medicine: "Amlodipine 5mg", scheduledAt: daysAgo(3), takenAt: null, status: "missed" },
      { id: "d6", medicine: "Metformin 500mg", scheduledAt: daysAgo(4), takenAt: daysAgo(4), status: "taken" },
      { id: "d7", medicine: "Glipizide 5mg", scheduledAt: daysAgo(4), takenAt: daysAgo(4), status: "taken" },
      { id: "d8", medicine: "Amlodipine 5mg", scheduledAt: daysAgo(5), takenAt: null, status: "missed" },
    ],
  },
  {
    id: "p2",
    name: "Rajesh Sharma",
    age: 58,
    phone: "+91 99001 56789",
    conditions: ["Heart Failure", "Hypertension", "Atrial Fibrillation"],
    riskLevel: "high",
    adherence7d: 57,
    adherence30d: 62,
    streak: 1,
    missedDoses30d: 14,
    lastActivity: daysAgo(1),
    notes: "Critical patient on diuretics. Missed Furosemide twice last week. Cardiologist alerted.",
    caregivers: [{ name: "Priya Sharma", relation: "Wife", phone: "+91 88002 11111" }],
    chartData: chart([60, 100, 0, 100, 60, 0, 100, 60, 0, 100, 60, 100, 0, 100]),
    doseLogs: [
      { id: "d1", medicine: "Furosemide 40mg", scheduledAt: daysAgo(0), takenAt: daysAgo(0), status: "taken" },
      { id: "d2", medicine: "Warfarin 2mg", scheduledAt: daysAgo(0), takenAt: null, status: "missed" },
      { id: "d3", medicine: "Metoprolol 25mg", scheduledAt: daysAgo(1), takenAt: daysAgo(1), status: "taken" },
      { id: "d4", medicine: "Furosemide 40mg", scheduledAt: daysAgo(2), takenAt: null, status: "missed" },
      { id: "d5", medicine: "Warfarin 2mg", scheduledAt: daysAgo(3), takenAt: daysAgo(3), status: "late" },
    ],
  },
  {
    id: "p3",
    name: "Sunita Pillai",
    age: 65,
    phone: "+91 97700 22334",
    conditions: ["Hypothyroidism", "Osteoporosis"],
    riskLevel: "medium",
    adherence7d: 71,
    adherence30d: 78,
    streak: 3,
    missedDoses30d: 7,
    lastActivity: daysAgo(1),
    notes: "Generally compliant. Misses weekend doses occasionally.",
    caregivers: [
      { name: "Anil Pillai", relation: "Husband", phone: "+91 97700 99999" },
      { name: "Dr. Meena", relation: "Endocrinologist", phone: "+91 80999 11122" },
    ],
    chartData: chart([100, 100, 50, 100, 100, 0, 100, 100, 50, 100, 100, 0, 100, 100]),
    doseLogs: [
      { id: "d1", medicine: "Levothyroxine 75mcg", scheduledAt: daysAgo(0), takenAt: daysAgo(0), status: "taken" },
      { id: "d2", medicine: "Calcium+D3", scheduledAt: daysAgo(0), takenAt: daysAgo(0), status: "late" },
      { id: "d3", medicine: "Levothyroxine 75mcg", scheduledAt: daysAgo(1), takenAt: daysAgo(1), status: "taken" },
      { id: "d4", medicine: "Calcium+D3", scheduledAt: daysAgo(2), takenAt: null, status: "missed" },
      { id: "d5", medicine: "Levothyroxine 75mcg", scheduledAt: daysAgo(3), takenAt: daysAgo(3), status: "taken" },
    ],
  },
  {
    id: "p4",
    name: "Mohammed Ismail",
    age: 69,
    phone: "+91 90002 77665",
    conditions: ["COPD", "Hypertension", "Type 2 Diabetes"],
    riskLevel: "high",
    adherence7d: 38,
    adherence30d: 44,
    streak: 0,
    missedDoses30d: 21,
    lastActivity: daysAgo(4),
    notes: "Lives alone. Breathing difficulties reported. Missed inhaler 4 days in a row.",
    caregivers: [{ name: "Fatima Ismail", relation: "Daughter", phone: "+91 90002 44332" }],
    chartData: chart([20, 0, 40, 0, 0, 60, 0, 40, 0, 0, 20, 0, 0, 40]),
    doseLogs: [
      { id: "d1", medicine: "Salbutamol Inhaler", scheduledAt: daysAgo(0), takenAt: null, status: "missed" },
      { id: "d2", medicine: "Tiotropium Inhaler", scheduledAt: daysAgo(1), takenAt: null, status: "missed" },
      { id: "d3", medicine: "Metformin 500mg", scheduledAt: daysAgo(2), takenAt: null, status: "missed" },
      { id: "d4", medicine: "Amlodipine 5mg", scheduledAt: daysAgo(3), takenAt: null, status: "missed" },
      { id: "d5", medicine: "Salbutamol Inhaler", scheduledAt: daysAgo(4), takenAt: daysAgo(4), status: "taken" },
    ],
  },
  {
    id: "p5",
    name: "Lakshmi Rajan",
    age: 61,
    phone: "+91 94400 55667",
    conditions: ["Hypertension"],
    riskLevel: "low",
    adherence7d: 94,
    adherence30d: 91,
    streak: 12,
    missedDoses30d: 2,
    lastActivity: daysAgo(0),
    notes: "Excellent adherence. Participates in monthly check-in calls proactively.",
    caregivers: [{ name: "Dr. Suresh", relation: "Cardiologist", phone: "+91 80000 33344" }],
    chartData: chart([100, 100, 100, 100, 100, 50, 100, 100, 100, 100, 100, 100, 50, 100]),
    doseLogs: [
      { id: "d1", medicine: "Telmisartan 40mg", scheduledAt: daysAgo(0), takenAt: daysAgo(0), status: "taken" },
      { id: "d2", medicine: "Amlodipine 5mg", scheduledAt: daysAgo(0), takenAt: daysAgo(0), status: "taken" },
      { id: "d3", medicine: "Telmisartan 40mg", scheduledAt: daysAgo(1), takenAt: daysAgo(1), status: "taken" },
      { id: "d4", medicine: "Amlodipine 5mg", scheduledAt: daysAgo(2), takenAt: null, status: "missed" },
      { id: "d5", medicine: "Telmisartan 40mg", scheduledAt: daysAgo(3), takenAt: daysAgo(3), status: "taken" },
    ],
  },
  {
    id: "p6",
    name: "Gopal Iyer",
    age: 77,
    phone: "+91 98800 44556",
    conditions: ["Parkinson's Disease", "Hypertension", "Depression"],
    riskLevel: "medium",
    adherence7d: 68,
    adherence30d: 72,
    streak: 2,
    missedDoses30d: 9,
    lastActivity: daysAgo(1),
    notes: "Tremors make pill handling difficult. Blister pack arranged. Son visits Tue/Thu.",
    caregivers: [
      { name: "Suresh Iyer", relation: "Son", phone: "+91 99000 77788" },
      { name: "Nurse Geetha", relation: "Home Nurse", phone: "+91 88800 22233" },
    ],
    chartData: chart([100, 50, 100, 100, 50, 100, 0, 100, 100, 50, 100, 100, 50, 100]),
    doseLogs: [
      { id: "d1", medicine: "Levodopa 100mg", scheduledAt: daysAgo(0), takenAt: daysAgo(0), status: "late" },
      { id: "d2", medicine: "Sertraline 50mg", scheduledAt: daysAgo(0), takenAt: daysAgo(0), status: "taken" },
      { id: "d3", medicine: "Levodopa 100mg", scheduledAt: daysAgo(1), takenAt: null, status: "missed" },
      { id: "d4", medicine: "Amlodipine 5mg", scheduledAt: daysAgo(2), takenAt: daysAgo(2), status: "taken" },
      { id: "d5", medicine: "Levodopa 100mg", scheduledAt: daysAgo(3), takenAt: daysAgo(3), status: "taken" },
    ],
  },
  {
    id: "p7",
    name: "Anitha George",
    age: 54,
    phone: "+91 96500 33445",
    conditions: ["Rheumatoid Arthritis", "Anaemia"],
    riskLevel: "low",
    adherence7d: 88,
    adherence30d: 86,
    streak: 7,
    missedDoses30d: 4,
    lastActivity: daysAgo(0),
    notes: "Good adherence. Methotrexate on Fridays only.",
    caregivers: [{ name: "Dr. Rekha", relation: "Rheumatologist", phone: "+91 80400 55566" }],
    chartData: chart([100, 100, 100, 50, 100, 100, 100, 100, 50, 100, 100, 100, 100, 100]),
    doseLogs: [
      { id: "d1", medicine: "Methotrexate 10mg", scheduledAt: daysAgo(0), takenAt: daysAgo(0), status: "taken" },
      { id: "d2", medicine: "Iron supplement", scheduledAt: daysAgo(1), takenAt: null, status: "missed" },
      { id: "d3", medicine: "Hydroxychloroquine", scheduledAt: daysAgo(2), takenAt: daysAgo(2), status: "taken" },
      { id: "d4", medicine: "Folic Acid 5mg", scheduledAt: daysAgo(3), takenAt: daysAgo(3), status: "taken" },
    ],
  },
  {
    id: "p8",
    name: "Venkatesh Naidu",
    age: 63,
    phone: "+91 99900 66778",
    conditions: ["Chronic Kidney Disease", "Hypertension", "Anaemia"],
    riskLevel: "medium",
    adherence7d: 74,
    adherence30d: 69,
    streak: 4,
    missedDoses30d: 11,
    lastActivity: daysAgo(1),
    notes: "Fluid restriction diet not followed consistently. Nephrologist review next week.",
    caregivers: [
      { name: "Kavitha Naidu", relation: "Wife", phone: "+91 99100 22233" },
      { name: "Dr. Balu", relation: "Nephrologist", phone: "+91 80300 44455" },
    ],
    chartData: chart([100, 100, 50, 100, 0, 100, 100, 50, 100, 100, 100, 0, 100, 100]),
    doseLogs: [
      { id: "d1", medicine: "Sevelamer 800mg", scheduledAt: daysAgo(0), takenAt: daysAgo(0), status: "late" },
      { id: "d2", medicine: "Calcitriol 0.25mcg", scheduledAt: daysAgo(1), takenAt: daysAgo(1), status: "taken" },
      { id: "d3", medicine: "Sevelamer 800mg", scheduledAt: daysAgo(2), takenAt: null, status: "missed" },
      { id: "d4", medicine: "Calcitriol 0.25mcg", scheduledAt: daysAgo(3), takenAt: daysAgo(3), status: "taken" },
    ],
  },
  {
    id: "p9",
    name: "Meenakshi Bai",
    age: 80,
    phone: "+91 94300 11223",
    conditions: ["Type 2 Diabetes", "Dementia (Mild)", "Hypertension"],
    riskLevel: "high",
    adherence7d: 29,
    adherence30d: 37,
    streak: 0,
    missedDoses30d: 25,
    lastActivity: daysAgo(2),
    notes: "Forgets doses due to cognitive decline. Smart dispenser recommended urgently.",
    caregivers: [{ name: "Ramu Bai", relation: "Son-in-law", phone: "+91 94300 88899" }],
    chartData: chart([0, 50, 0, 0, 60, 0, 0, 50, 0, 0, 40, 0, 0, 0]),
    doseLogs: [
      { id: "d1", medicine: "Metformin 500mg", scheduledAt: daysAgo(0), takenAt: null, status: "missed" },
      { id: "d2", medicine: "Telmisartan 40mg", scheduledAt: daysAgo(0), takenAt: null, status: "missed" },
      { id: "d3", medicine: "Donepezil 5mg", scheduledAt: daysAgo(1), takenAt: null, status: "missed" },
      { id: "d4", medicine: "Telmisartan 40mg", scheduledAt: daysAgo(2), takenAt: daysAgo(2), status: "taken" },
      { id: "d5", medicine: "Metformin 500mg", scheduledAt: daysAgo(3), takenAt: null, status: "missed" },
    ],
  },
  {
    id: "p10",
    name: "Krishnamurthy S.",
    age: 67,
    phone: "+91 97200 99001",
    conditions: ["Asthma", "Hypertension"],
    riskLevel: "low",
    adherence7d: 96,
    adherence30d: 93,
    streak: 18,
    missedDoses30d: 2,
    lastActivity: daysAgo(0),
    notes: "Best adherence in cohort. Uses medication reminder app independently.",
    caregivers: [{ name: "Vimala K.", relation: "Wife", phone: "+91 97200 55566" }],
    chartData: chart([100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 50, 100, 100, 100]),
    doseLogs: [
      { id: "d1", medicine: "Budesonide Inhaler", scheduledAt: daysAgo(0), takenAt: daysAgo(0), status: "taken" },
      { id: "d2", medicine: "Salbutamol Inhaler", scheduledAt: daysAgo(0), takenAt: daysAgo(0), status: "taken" },
      { id: "d3", medicine: "Telmisartan 40mg", scheduledAt: daysAgo(1), takenAt: daysAgo(1), status: "taken" },
      { id: "d4", medicine: "Budesonide Inhaler", scheduledAt: daysAgo(1), takenAt: daysAgo(1), status: "taken" },
      { id: "d5", medicine: "Salbutamol Inhaler", scheduledAt: daysAgo(2), takenAt: null, status: "missed" },
    ],
  },
];

export const ESCALATION_LOGS: EscalationLog[] = [
  { id: "e1", patientId: "p1", type: "sms", sentAt: daysAgo(1), status: "delivered", note: "Missed 3 doses - SMS reminder sent to Kamala Devi" },
  { id: "e2", patientId: "p4", type: "call", sentAt: daysAgo(2), status: "delivered", note: "No response for 4 days - automated call triggered" },
  { id: "e3", patientId: "p9", type: "family_alert", sentAt: daysAgo(2), status: "delivered", note: "High missed doses - family alert sent to Ramu Bai" },
  { id: "e4", patientId: "p2", type: "sms", sentAt: daysAgo(3), status: "delivered", note: "Warfarin missed - urgent SMS to Rajesh Sharma" },
  { id: "e5", patientId: "p1", type: "call", sentAt: daysAgo(4), status: "failed", note: "Automated call failed - no answer (Kamala Devi)" },
  { id: "e6", patientId: "p4", type: "family_alert", sentAt: daysAgo(5), status: "delivered", note: "Inhaler missed 2 days - family alerted" },
  { id: "e7", patientId: "p9", type: "sms", sentAt: daysAgo(5), status: "delivered", note: "Morning doses missed - reminder sent" },
  { id: "e8", patientId: "p2", type: "call", sentAt: daysAgo(6), status: "delivered", note: "Cardiac medication adherence check call" },
];

export function getPatient(id: string): Patient | undefined {
  return PATIENTS.find((p) => p.id === id);
}

export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return mins + "m ago";
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return hrs + "h ago";
  return Math.floor(hrs / 24) + "d ago";
}

export const riskLabel: Record<RiskLevel, string> = {
  high: "High Risk",
  medium: "Medium Risk",
  low: "Low Risk",
};
