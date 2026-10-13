// lib/medication-checks.ts
// Server-side storage for Outbound Patient Medication Check Voice Calls

import path from "path";
import fs from "fs";

export type MedicationCheckStatus =
  | "calling"
  | "in_progress"
  | "completed"
  | "no_response"
  | "failed";

export type MedicationCheckResponse =
  | "Taken"
  | "Not Taken"
  | "Skipped"
  | "Rescheduled"
  | "No Response"
  | "Pending"
  | "taken"
  | "not_taken"
  | "skipped"
  | "rescheduled"
  | "no_response"
  | "pending"
  | (string & {});

export interface MedicationCheckRecord {
  id: string;
  patientId: string;
  patientName: string;
  phone: string;
  callSid?: string;
  /** The ScheduledDose id this call is for — used to auto-mark dose as taken */
  doseId?: string;
  /** Medicine name passed from the scheduler for context */
  medicineName?: string;
  status: MedicationCheckStatus;
  response: MedicationCheckResponse;
  channel?: "voice_call" | "sms" | "telegram";
  isDeaf?: boolean;
  digits?: string;
  notes?: string;
  timestamp: string; // ISO timestamp
  createdAt: string; // ISO
  updatedAt: string; // ISO
}

// In-memory cache + file persistence for guaranteed reliability across all environments
const memoryStore = new Map<string, MedicationCheckRecord>();

const STORAGE_FILE = path.join(process.cwd(), "data", "medication_checks.json");

function ensureStorageFile() {
  try {
    const dir = path.dirname(STORAGE_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    if (!fs.existsSync(STORAGE_FILE)) {
      fs.writeFileSync(STORAGE_FILE, JSON.stringify([]), "utf-8");
    }
  } catch (err) {
    console.error("[medication-checks] Failed to ensure storage file:", err);
  }
}

function loadFromFile(): MedicationCheckRecord[] {
  try {
    ensureStorageFile();
    if (fs.existsSync(STORAGE_FILE)) {
      const raw = fs.readFileSync(STORAGE_FILE, "utf-8");
      return JSON.parse(raw);
    }
  } catch (err) {
    console.error("[medication-checks] Failed to load from file:", err);
  }
  return [];
}

function saveToFile(list: MedicationCheckRecord[]) {
  try {
    ensureStorageFile();
    fs.writeFileSync(STORAGE_FILE, JSON.stringify(list, null, 2), "utf-8");
  } catch (err) {
    console.error("[medication-checks] Failed to save to file:", err);
  }
}

// Initialize memory store on load
try {
  const existing = loadFromFile();
  for (const item of existing) {
    memoryStore.set(item.id, item);
  }
} catch {
  // ignore
}

export function saveMedicationCheck(
  recordInput: Omit<MedicationCheckRecord, "timestamp"> & { timestamp?: string }
): MedicationCheckRecord {
  const nowIso = new Date().toISOString();
  const record: MedicationCheckRecord = {
    ...recordInput,
    timestamp: recordInput.timestamp || recordInput.updatedAt || recordInput.createdAt || nowIso,
  };
  memoryStore.set(record.id, record);
  const all = Array.from(memoryStore.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  saveToFile(all);
  return record;
}

export function updateMedicationCheck(
  id: string,
  updates: Partial<Omit<MedicationCheckRecord, "id" | "patientId" | "createdAt">>
): MedicationCheckRecord | undefined {
  const current = memoryStore.get(id);
  if (!current) return undefined;

  const nowIso = new Date().toISOString();
  const updated: MedicationCheckRecord = {
    ...current,
    ...updates,
    timestamp: nowIso,
    updatedAt: nowIso,
  };

  memoryStore.set(id, updated);
  const all = Array.from(memoryStore.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  saveToFile(all);
  return updated;
}

export function getMedicationCheckById(id: string): MedicationCheckRecord | undefined {
  return memoryStore.get(id);
}

export function getMedicationCheckByCallSid(callSid: string): MedicationCheckRecord | undefined {
  if (!callSid) return undefined;
  for (const record of memoryStore.values()) {
    if (record.callSid === callSid) return record;
  }
  return undefined;
}

export function updateMedicationCheckByCallSidOrId(
  identifier: string,
  updates: Partial<Omit<MedicationCheckRecord, "id" | "patientId" | "createdAt">>
): MedicationCheckRecord | undefined {
  if (!identifier) return undefined;
  // Try by id first
  if (memoryStore.has(identifier)) {
    return updateMedicationCheck(identifier, updates);
  }
  // Try by callSid
  const record = getMedicationCheckByCallSid(identifier);
  if (record) {
    return updateMedicationCheck(record.id, updates);
  }
  return undefined;
}

export function getMedicationChecks(patientId?: string): MedicationCheckRecord[] {
  const all = Array.from(memoryStore.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  if (patientId) {
    return all.filter((r) => r.patientId === patientId);
  }
  return all;
}

export function getLatestMedicationCheck(patientId: string): MedicationCheckRecord | undefined {
  const checks = getMedicationChecks(patientId);
  return checks.length > 0 ? checks[0] : undefined;
}

export function getLatestMedicationCheckByPhone(phone: string): MedicationCheckRecord | undefined {
  const clean = phone.replace(/\D/g, "");
  const all = Array.from(memoryStore.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  return all.find((r) => {
    const rClean = (r.phone || "").replace(/\D/g, "");
    return rClean === clean || rClean.endsWith(clean) || clean.endsWith(rClean);
  });
}

export function upsertMedicationCheck(
  idOrSid: string,
  patientId: string,
  updates: Partial<MedicationCheckRecord>
): MedicationCheckRecord {
  const existing = idOrSid
    ? getMedicationCheckById(idOrSid) || getMedicationCheckByCallSid(idOrSid)
    : undefined;
  const nowIso = new Date().toISOString();

  if (existing) {
    const updated: MedicationCheckRecord = {
      ...existing,
      ...updates,
      patientId: patientId || existing.patientId,
      timestamp: nowIso,
      updatedAt: nowIso,
    };
    memoryStore.set(existing.id, updated);
    const all = Array.from(memoryStore.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    saveToFile(all);
    return updated;
  }

  // Fallback: check if there is an in-progress record for this patient
  if (patientId) {
    const latestForPatient = getLatestMedicationCheck(patientId);
    if (latestForPatient && (latestForPatient.response === "Pending" || latestForPatient.response === "pending")) {
      const updated: MedicationCheckRecord = {
        ...latestForPatient,
        ...updates,
        timestamp: nowIso,
        updatedAt: nowIso,
      };
      memoryStore.set(latestForPatient.id, updated);
      const all = Array.from(memoryStore.values()).sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      saveToFile(all);
      return updated;
    }
  }

  // Create new record
  const newId = idOrSid || `mc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const created: MedicationCheckRecord = {
    id: newId,
    patientId: patientId || "patient-1",
    patientName: updates.patientName || "Patient",
    phone: updates.phone || "+917406842246",
    callSid: updates.callSid || (idOrSid.startsWith("CA") ? idOrSid : undefined),
    status: updates.status || "completed",
    response: updates.response || "No Response",
    digits: updates.digits,
    notes: updates.notes || "Recorded via Twilio IVR",
    timestamp: nowIso,
    createdAt: nowIso,
    updatedAt: nowIso,
    ...updates,
  };
  memoryStore.set(newId, created);
  const all = Array.from(memoryStore.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  saveToFile(all);
  return created;
}

