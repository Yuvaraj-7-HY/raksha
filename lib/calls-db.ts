// lib/calls-db.ts
// Calls table CRUD — singleton better-sqlite3 handle, WAL mode

import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { DB_PATH } from "./config";

type GlobalWithCallsDb = typeof globalThis & { __callsDb?: Database.Database };

function openCallsDb(): Database.Database {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  db.exec(`
    CREATE TABLE IF NOT EXISTS calls (
      id TEXT PRIMARY KEY,
      twilio_call_sid TEXT,
      created_at TEXT NOT NULL,
      ended_at TEXT,
      call_type TEXT NOT NULL,
      context TEXT,
      attempt INTEGER DEFAULT 1,
      to_number TEXT NOT NULL,
      status TEXT DEFAULT 'queued',
      history_json TEXT DEFAULT '[]',
      turn_index INTEGER DEFAULT 0,
      noinput_count INTEGER DEFAULT 0,
      reply_source TEXT,
      emergency INTEGER DEFAULT 0,
      finalized INTEGER DEFAULT 0,
      result_json TEXT
    );
  `);

  return db;
}

export function getCallsDb(): Database.Database {
  const g = globalThis as GlobalWithCallsDb;
  if (!g.__callsDb) {
    g.__callsDb = openCallsDb();
  }
  return g.__callsDb;
}

export type CallRow = {
  id: string;
  twilio_call_sid: string | null;
  created_at: string;
  ended_at: string | null;
  call_type: string;
  context: string | null;
  attempt: number;
  to_number: string;
  status: string;
  history_json: string;
  turn_index: number;
  noinput_count: number;
  reply_source: string | null;
  emergency: number;
  finalized: number;
  result_json: string | null;
};

export type CallHistoryItem = { role: "ai" | "grandma"; text: string; ts: number };

export function createCall(row: {
  id: string;
  call_type: string;
  context: string | null;
  attempt: number;
  to_number: string;
}): void {
  const db = getCallsDb();
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO calls (id, call_type, context, attempt, to_number, created_at, status, history_json)
    VALUES (?, ?, ?, ?, ?, ?, 'queued', '[]')
  `).run(row.id, row.call_type, row.context, row.attempt, row.to_number, now);
}

export function getCall(id: string): CallRow | null {
  const db = getCallsDb();
  return db.prepare("SELECT * FROM calls WHERE id = ?").get(id) as CallRow | null;
}

export function updateCallStatus(id: string, status: string, twilioCallSid?: string): void {
  const db = getCallsDb();
  if (twilioCallSid) {
    db.prepare("UPDATE calls SET status = ?, twilio_call_sid = ? WHERE id = ?").run(status, twilioCallSid, id);
  } else {
    db.prepare("UPDATE calls SET status = ? WHERE id = ?").run(status, id);
  }
}

export function setCallEnded(id: string): void {
  const db = getCallsDb();
  db.prepare("UPDATE calls SET ended_at = ?, status = 'completed' WHERE id = ?").run(new Date().toISOString(), id);
}

export function appendHistory(id: string, item: CallHistoryItem): void {
  const db = getCallsDb();
  const row = db.prepare("SELECT history_json, turn_index FROM calls WHERE id = ?").get(id) as { history_json: string; turn_index: number } | null;
  if (!row) return;
  const history = JSON.parse(row.history_json) as CallHistoryItem[];
  history.push(item);
  db.prepare("UPDATE calls SET history_json = ?, turn_index = ? WHERE id = ?").run(JSON.stringify(history), row.turn_index + 1, id);
}

export function incrementNoInput(id: string): number {
  const db = getCallsDb();
  db.prepare("UPDATE calls SET noinput_count = noinput_count + 1 WHERE id = ?").run(id);
  const row = db.prepare("SELECT noinput_count FROM calls WHERE id = ?").get(id) as { noinput_count: number } | null;
  return row?.noinput_count ?? 0;
}

export function setReplySource(id: string, source: "n8n" | "fallback"): void {
  const db = getCallsDb();
  db.prepare("UPDATE calls SET reply_source = ? WHERE id = ?").run(source, id);
}

export function setEmergency(id: string, emergency: boolean): void {
  const db = getCallsDb();
  db.prepare("UPDATE calls SET emergency = ? WHERE id = ?").run(emergency ? 1 : 0, id);
}

export function markFinalized(id: string): boolean {
  const db = getCallsDb();
  const row = db.prepare("SELECT finalized FROM calls WHERE id = ?").get(id) as { finalized: number } | null;
  if (!row || row.finalized === 1) return false;
  db.prepare("UPDATE calls SET finalized = 1 WHERE id = ?").run(id);
  return true;
}

export function setResult(id: string, result: unknown): void {
  const db = getCallsDb();
  db.prepare("UPDATE calls SET result_json = ? WHERE id = ?").run(JSON.stringify(result), id);
}

export function getRecentCalls(limit = 20): CallRow[] {
  const db = getCallsDb();
  return db.prepare("SELECT * FROM calls ORDER BY created_at DESC LIMIT ?").all(limit) as CallRow[];
}

export function parseHistory(json: string): CallHistoryItem[] {
  try {
    return JSON.parse(json) as CallHistoryItem[];
  } catch {
    return [];
  }
}