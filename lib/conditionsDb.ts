// lib/conditionsDb.ts
// Server-side data access layer for Condition-Aware Care
// Targets Supabase Postgres with automatic SQLite fallback for bulletproof persistence.

import { db } from "./supabaseServer";
import { getDb } from "./db";
import type {
  ConditionType,
  Reading,
  ConditionAlert,
  CaregiverLog,
  MoodCheck,
  CarePlan,
  PatientCondition,
} from "@/types/conditions";
import { DEFAULT_THRESHOLDS } from "@/types/conditions";
import { getTodayIst } from "./istDate";

// SQLite schema initialization for seamless fallback
function initSqliteConditionTables() {
  const sqlite = getDb();
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS patient_conditions (
      id TEXT PRIMARY KEY,
      patient_id TEXT NOT NULL,
      condition_type TEXT NOT NULL,
      diagnosed_on TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE (patient_id, condition_type)
    );

    CREATE TABLE IF NOT EXISTS readings (
      id TEXT PRIMARY KEY,
      patient_id TEXT NOT NULL,
      condition_type TEXT NOT NULL,
      reading_type TEXT NOT NULL,
      value REAL NOT NULL,
      unit TEXT NOT NULL,
      note TEXT,
      source TEXT NOT NULL,
      recorded_at TEXT NOT NULL DEFAULT (datetime('now')),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS care_plans (
      id TEXT PRIMARY KEY,
      patient_id TEXT NOT NULL,
      condition_type TEXT NOT NULL,
      thresholds TEXT NOT NULL DEFAULT '{}',
      updated_by TEXT NOT NULL DEFAULT 'care_team',
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE (patient_id, condition_type)
    );

    CREATE TABLE IF NOT EXISTS condition_alerts (
      id TEXT PRIMARY KEY,
      patient_id TEXT NOT NULL,
      condition_type TEXT NOT NULL,
      severity TEXT NOT NULL,
      alert_type TEXT NOT NULL,
      message TEXT NOT NULL,
      related_reading_id TEXT,
      status TEXT NOT NULL DEFAULT 'open',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      acknowledged_at TEXT
    );

    CREATE TABLE IF NOT EXISTS caregiver_logs (
      id TEXT PRIMARY KEY,
      patient_id TEXT NOT NULL,
      logged_by TEXT NOT NULL,
      confusion_level INTEGER NOT NULL,
      sleep_quality INTEGER NOT NULL,
      appetite INTEGER NOT NULL,
      agitation_or_wandering INTEGER NOT NULL DEFAULT 0,
      medicine_confirmed INTEGER NOT NULL DEFAULT 0,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS mood_checks (
      id TEXT PRIMARY KEY,
      patient_id TEXT NOT NULL,
      questionnaire TEXT NOT NULL,
      answers TEXT NOT NULL,
      total_score INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
}

// ── PATIENT CONDITIONS ─────────────────────────────────────────────────────────

export async function getPatientConditions(patientId: string): Promise<PatientCondition[]> {
  try {
    const supabase = db.get();
    const { data, error } = await supabase
      .from("patient_conditions")
      .select("*")
      .eq("patient_id", patientId)
      .eq("is_active", true);

    if (!error && data) {
      return data as PatientCondition[];
    }
  } catch (err) {
    // Fall through to SQLite
  }

  initSqliteConditionTables();
  const sqlite = getDb();
  const rows = sqlite
    .prepare("SELECT * FROM patient_conditions WHERE patient_id = ? AND is_active = 1")
    .all(patientId) as any[];

  return rows.map((r) => ({
    ...r,
    is_active: Boolean(r.is_active),
  }));
}

export async function setPatientCondition(
  patientId: string,
  conditionType: ConditionType,
  isActive: boolean,
  diagnosedOn?: string
): Promise<boolean> {
  const now = new Date().toISOString();
  try {
    const supabase = db.get();
    const { error } = await supabase.from("patient_conditions").upsert(
      {
        patient_id: patientId,
        condition_type: conditionType,
        is_active: isActive,
        diagnosed_on: diagnosedOn || null,
        created_at: now,
      },
      { onConflict: "patient_id,condition_type" }
    );
    if (!error) return true;
  } catch (err) {
    // Fall through
  }

  initSqliteConditionTables();
  const sqlite = getDb();
  const id = `cond_${patientId}_${conditionType}`;
  sqlite
    .prepare(`
      INSERT INTO patient_conditions (id, patient_id, condition_type, diagnosed_on, is_active, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(patient_id, condition_type) DO UPDATE SET
        is_active = excluded.is_active,
        diagnosed_on = coalesce(excluded.diagnosed_on, patient_conditions.diagnosed_on)
    `)
    .run(id, patientId, conditionType, diagnosedOn || null, isActive ? 1 : 0, now);

  return true;
}

// ── READINGS ──────────────────────────────────────────────────────────────────

export async function getReadings(opts: {
  patientId: string;
  conditionType?: ConditionType;
  readingType?: string;
  from?: string;
  to?: string;
  limit?: number;
}): Promise<Reading[]> {
  const { patientId, conditionType, readingType, from, to, limit = 100 } = opts;

  try {
    const supabase = db.get();
    let query = supabase
      .from("readings")
      .select("*")
      .eq("patient_id", patientId)
      .order("recorded_at", { ascending: false })
      .limit(limit);

    if (conditionType) query = query.eq("condition_type", conditionType);
    if (readingType) query = query.eq("reading_type", readingType);
    if (from) query = query.gte("recorded_at", from);
    if (to) query = query.lte("recorded_at", to);

    const { data, error } = await query;
    if (!error && data) {
      return data as Reading[];
    }
  } catch (err) {
    // Fall through
  }

  initSqliteConditionTables();
  const sqlite = getDb();
  let sql = "SELECT * FROM readings WHERE patient_id = ?";
  const params: any[] = [patientId];

  if (conditionType) {
    sql += " AND condition_type = ?";
    params.push(conditionType);
  }
  if (readingType) {
    sql += " AND reading_type = ?";
    params.push(readingType);
  }
  if (from) {
    sql += " AND recorded_at >= ?";
    params.push(from);
  }
  if (to) {
    sql += " AND recorded_at <= ?";
    params.push(to);
  }

  sql += " ORDER BY recorded_at DESC LIMIT ?";
  params.push(limit);

  return sqlite.prepare(sql).all(...params) as Reading[];
}

export async function insertReading(reading: Omit<Reading, "id" | "created_at">): Promise<Reading> {
  const id = `rd_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const now = new Date().toISOString();
  const fullReading: Reading = {
    ...reading,
    id,
    created_at: now,
    recorded_at: reading.recorded_at || now,
  };

  try {
    const supabase = db.get();
    const { data, error } = await supabase.from("readings").insert(fullReading).select().single();
    if (!error && data) {
      return data as Reading;
    }
  } catch (err) {
    // Fall through
  }

  initSqliteConditionTables();
  const sqlite = getDb();
  sqlite
    .prepare(`
      INSERT INTO readings (id, patient_id, condition_type, reading_type, value, unit, note, source, recorded_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    .run(
      fullReading.id,
      fullReading.patient_id,
      fullReading.condition_type,
      fullReading.reading_type,
      fullReading.value,
      fullReading.unit,
      fullReading.note || null,
      fullReading.source,
      fullReading.recorded_at,
      fullReading.created_at
    );

  return fullReading;
}

// ── CARE PLANS & THRESHOLDS ───────────────────────────────────────────────────

export async function getCarePlan(patientId: string, conditionType: ConditionType): Promise<CarePlan> {
  const defaultPlan: CarePlan = {
    id: `cp_${patientId}_${conditionType}`,
    patient_id: patientId,
    condition_type: conditionType,
    thresholds: DEFAULT_THRESHOLDS[conditionType],
    updated_by: "care_team",
    updated_at: new Date().toISOString(),
  };

  try {
    const supabase = db.get();
    const { data, error } = await supabase
      .from("care_plans")
      .select("*")
      .eq("patient_id", patientId)
      .eq("condition_type", conditionType)
      .single();

    if (!error && data) {
      return {
        ...data,
        thresholds: typeof data.thresholds === "string" ? JSON.parse(data.thresholds) : data.thresholds,
      };
    }
  } catch (err) {
    // Fall through
  }

  initSqliteConditionTables();
  const sqlite = getDb();
  const row = sqlite
    .prepare("SELECT * FROM care_plans WHERE patient_id = ? AND condition_type = ?")
    .get(patientId, conditionType) as any;

  if (row) {
    return {
      ...row,
      thresholds: JSON.parse(row.thresholds),
    };
  }

  return defaultPlan;
}

export async function saveCarePlan(
  patientId: string,
  conditionType: ConditionType,
  thresholds: Record<string, any>,
  updatedBy: string = "clinician"
): Promise<CarePlan> {
  const now = new Date().toISOString();
  const record = {
    patient_id: patientId,
    condition_type: conditionType,
    thresholds,
    updated_by: updatedBy,
    updated_at: now,
  };

  try {
    const supabase = db.get();
    const { data, error } = await supabase
      .from("care_plans")
      .upsert(record, { onConflict: "patient_id,condition_type" })
      .select()
      .single();

    if (!error && data) {
      return data as CarePlan;
    }
  } catch (err) {
    // Fall through
  }

  initSqliteConditionTables();
  const sqlite = getDb();
  const id = `cp_${patientId}_${conditionType}`;
  sqlite
    .prepare(`
      INSERT INTO care_plans (id, patient_id, condition_type, thresholds, updated_by, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(patient_id, condition_type) DO UPDATE SET
        thresholds = excluded.thresholds,
        updated_by = excluded.updated_by,
        updated_at = excluded.updated_at
    `)
    .run(id, patientId, conditionType, JSON.stringify(thresholds), updatedBy, now);

  return { id, ...record };
}

// ── CONDITION ALERTS ──────────────────────────────────────────────────────────

export async function getConditionAlerts(opts?: {
  patientId?: string;
  status?: string;
  conditionType?: ConditionType;
  limit?: number;
}): Promise<ConditionAlert[]> {
  const { patientId, status, conditionType, limit = 50 } = opts || {};

  try {
    const supabase = db.get();
    let query = supabase
      .from("condition_alerts")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (patientId) query = query.eq("patient_id", patientId);
    if (status) query = query.eq("status", status);
    if (conditionType) query = query.eq("condition_type", conditionType);

    const { data, error } = await query;
    if (!error && data) {
      return data as ConditionAlert[];
    }
  } catch (err) {
    // Fall through
  }

  initSqliteConditionTables();
  const sqlite = getDb();
  let sql = `
    SELECT ca.*
    FROM condition_alerts ca
    WHERE 1=1
  `;
  const params: any[] = [];

  if (patientId) {
    sql += " AND ca.patient_id = ?";
    params.push(patientId);
  }
  if (status) {
    sql += " AND ca.status = ?";
    params.push(status);
  }
  if (conditionType) {
    sql += " AND ca.condition_type = ?";
    params.push(conditionType);
  }

  sql += " ORDER BY ca.created_at DESC LIMIT ?";
  params.push(limit);

  return sqlite.prepare(sql).all(...params) as ConditionAlert[];
}

export async function insertConditionAlert(
  alert: Omit<ConditionAlert, "id" | "created_at">
): Promise<ConditionAlert> {
  const id = `alt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const now = new Date().toISOString();
  const fullAlert: ConditionAlert = {
    ...alert,
    id,
    created_at: now,
  };

  try {
    const supabase = db.get();
    const { data, error } = await supabase
      .from("condition_alerts")
      .insert({
        ...fullAlert,
        alert_type: fullAlert.alert_type || "general",
      })
      .select()
      .single();

    if (!error && data) {
      return data as ConditionAlert;
    }
  } catch (err) {
    // Fall through
  }

  initSqliteConditionTables();
  const sqlite = getDb();
  sqlite
    .prepare(`
      INSERT INTO condition_alerts (id, patient_id, condition_type, severity, alert_type, message, related_reading_id, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    .run(
      fullAlert.id,
      fullAlert.patient_id,
      fullAlert.condition_type,
      fullAlert.severity,
      fullAlert.alert_type || "general",
      fullAlert.message,
      fullAlert.related_reading_id || null,
      fullAlert.status,
      fullAlert.created_at
    );

  return fullAlert;
}

export async function updateAlertStatus(
  alertId: string,
  status: "acknowledged" | "resolved"
): Promise<boolean> {
  const now = new Date().toISOString();
  try {
    const supabase = db.get();
    const patch: any = { status };
    if (status === "acknowledged") patch.acknowledged_at = now;

    const { error } = await supabase.from("condition_alerts").update(patch).eq("id", alertId);
    if (!error) return true;
  } catch (err) {
    // Fall through
  }

  initSqliteConditionTables();
  const sqlite = getDb();
  sqlite
    .prepare(`
      UPDATE condition_alerts
      SET status = ?, acknowledged_at = coalesce(acknowledged_at, ?)
      WHERE id = ?
    `)
    .run(status, status === "acknowledged" ? now : null, alertId);

  return true;
}

// ── CAREGIVER LOGS (DEMENTIA) ─────────────────────────────────────────────────

export async function getCaregiverLogs(patientId: string, limit: number = 20): Promise<CaregiverLog[]> {
  try {
    const supabase = db.get();
    const { data, error } = await supabase
      .from("caregiver_logs")
      .select("*")
      .eq("patient_id", patientId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (!error && data) return data as CaregiverLog[];
  } catch (err) {
    // Fall through
  }

  initSqliteConditionTables();
  const sqlite = getDb();
  const rows = sqlite
    .prepare("SELECT * FROM caregiver_logs WHERE patient_id = ? ORDER BY created_at DESC LIMIT ?")
    .all(patientId, limit) as any[];

  return rows.map((r) => ({
    ...r,
    agitation_or_wandering: Boolean(r.agitation_or_wandering),
    medicine_confirmed: Boolean(r.medicine_confirmed),
  }));
}

export async function insertCaregiverLog(
  log: Omit<CaregiverLog, "id" | "created_at"> & { created_at?: string }
): Promise<CaregiverLog> {
  const id = `cl_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const now = new Date().toISOString();
  const fullLog: CaregiverLog = {
    ...log,
    id,
    created_at: log.created_at || now,
  };

  try {
    const supabase = db.get();
    const { data, error } = await supabase.from("caregiver_logs").insert(fullLog).select().single();
    if (!error && data) return data as CaregiverLog;
  } catch (err) {
    // Fall through
  }

  initSqliteConditionTables();
  const sqlite = getDb();
  sqlite
    .prepare(`
      INSERT INTO caregiver_logs (id, patient_id, logged_by, confusion_level, sleep_quality, appetite, agitation_or_wandering, medicine_confirmed, notes, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    .run(
      fullLog.id,
      fullLog.patient_id,
      fullLog.logged_by,
      fullLog.confusion_level,
      fullLog.sleep_quality,
      fullLog.appetite,
      fullLog.agitation_or_wandering ? 1 : 0,
      fullLog.medicine_confirmed ? 1 : 0,
      fullLog.notes || null,
      fullLog.created_at
    );

  return fullLog;
}

// ── MOOD CHECKS (DEPRESSION) ──────────────────────────────────────────────────

export async function getMoodChecks(patientId: string, limit: number = 20): Promise<MoodCheck[]> {
  try {
    const supabase = db.get();
    const { data, error } = await supabase
      .from("mood_checks")
      .select("*")
      .eq("patient_id", patientId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (!error && data) {
      return data.map((d: any) => ({
        ...d,
        answers: typeof d.answers === "string" ? JSON.parse(d.answers) : d.answers,
      }));
    }
  } catch (err) {
    // Fall through
  }

  initSqliteConditionTables();
  const sqlite = getDb();
  const rows = sqlite
    .prepare("SELECT * FROM mood_checks WHERE patient_id = ? ORDER BY created_at DESC LIMIT ?")
    .all(patientId, limit) as any[];

  return rows.map((r) => ({
    ...r,
    answers: JSON.parse(r.answers),
  }));
}

export async function insertMoodCheck(
  check: Omit<MoodCheck, "id" | "created_at"> & { created_at?: string }
): Promise<MoodCheck> {
  const id = `mc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const now = new Date().toISOString();
  const fullCheck: MoodCheck = {
    ...check,
    id,
    created_at: check.created_at || now,
  };

  try {
    const supabase = db.get();
    const { data, error } = await supabase.from("mood_checks").insert(fullCheck).select().single();
    if (!error && data) {
      return {
        ...data,
        answers: typeof data.answers === "string" ? JSON.parse(data.answers) : data.answers,
      };
    }
  } catch (err) {
    // Fall through
  }

  initSqliteConditionTables();
  const sqlite = getDb();
  sqlite
    .prepare(`
      INSERT INTO mood_checks (id, patient_id, questionnaire, answers, total_score, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `)
    .run(
      fullCheck.id,
      fullCheck.patient_id,
      fullCheck.questionnaire,
      JSON.stringify(fullCheck.answers),
      fullCheck.total_score,
      fullCheck.created_at
    );

  return fullCheck;
}
