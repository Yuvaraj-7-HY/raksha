// lib/db.ts
// Singleton better-sqlite3 handle.
// Uses globalThis so Next.js hot reload does not open duplicate file handles.
// The worker process also imports this — both share the same WAL-mode file.

import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { DB_PATH } from "./config";

type GlobalWithDb = typeof globalThis & { __careDb?: Database.Database };

function openDb(): Database.Database {
  // Ensure the data/ directory exists.
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const db = new Database(DB_PATH);

  // WAL mode: allows the worker and the Next.js server to read/write concurrently.
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  // ── Schema ────────────────────────────────────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS patient (
      id                    INTEGER PRIMARY KEY,
      name                  TEXT    NOT NULL,
      age                   INTEGER NOT NULL,
      city                  TEXT    NOT NULL,
      lives_alone           INTEGER NOT NULL DEFAULT 1,   -- 1 = true
      morning_time          TEXT    NOT NULL DEFAULT '08:00',
      evening_time          TEXT    NOT NULL DEFAULT '18:00',
      family_contact_name   TEXT    NOT NULL DEFAULT 'Family'
    );

    CREATE TABLE IF NOT EXISTS timeline (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      created_at       TEXT    NOT NULL DEFAULT (datetime('now')),
      call_id          TEXT,
      call_type        TEXT,
      outcome          TEXT,              -- completed | missed | declined
      medication_slot  TEXT,              -- morning | evening | none
      medication_taken TEXT,              -- yes | no | unclear | not_asked
      symptom          TEXT,
      severity         TEXT,              -- none | mild | moderate | severe | unclear
      symptom_trend    TEXT,              -- new | improved | same | worse | not_applicable
      concern_level    INTEGER DEFAULT 1, -- 1 | 2 | 3
      emergency        INTEGER DEFAULT 0, -- 0 | 1
      summary          TEXT,
      transcript_json  TEXT               -- JSON array of {role, text, ts}
    );

    CREATE TABLE IF NOT EXISTS followups (
      id                 INTEGER PRIMARY KEY AUTOINCREMENT,
      created_at         TEXT    NOT NULL DEFAULT (datetime('now')),
      due_at             TEXT    NOT NULL,
      type               TEXT    NOT NULL, -- retry | followup
      call_type_to_use   TEXT    NOT NULL, -- morning | evening | followup
      context            TEXT    NOT NULL DEFAULT '',
      attempt            INTEGER NOT NULL DEFAULT 0,
      parent_timeline_id INTEGER REFERENCES timeline(id),
      status             TEXT    NOT NULL DEFAULT 'pending', -- pending | ringing | done | cancelled
      call_id            TEXT                                -- set when ringing
    );

    CREATE TABLE IF NOT EXISTS ring_state (
      id               INTEGER PRIMARY KEY DEFAULT 1,
      status           TEXT    NOT NULL DEFAULT 'idle', -- idle | ringing | in_call
      call_id          TEXT,
      call_type        TEXT,
      context          TEXT,
      attempt          INTEGER NOT NULL DEFAULT 0,
      ring_started_at  TEXT    -- ISO UTC string; null when idle or in_call
    );

    CREATE TABLE IF NOT EXISTS alerts_sent (
      call_id  TEXT NOT NULL,
      type     TEXT NOT NULL,
      sent_at  TEXT NOT NULL DEFAULT (datetime('now')),
      via      TEXT NOT NULL DEFAULT 'direct', -- n8n | direct
      UNIQUE(call_id, type)
    );
  `);

  return db;
}

export function getDb(): Database.Database {
  const g = globalThis as GlobalWithDb;
  if (!g.__careDb) {
    g.__careDb = openDb();
  }
  return g.__careDb;
}
