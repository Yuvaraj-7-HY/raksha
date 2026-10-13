// scripts/seed.ts
// Idempotent: safe to run multiple times.
// Usage:  npm run seed

import { getDb } from "../lib/db";

const db = getDb();

// ── Patient ───────────────────────────────────────────────────────────────────
db.prepare(`
  INSERT OR REPLACE INTO patient
    (id, name, age, city, lives_alone, morning_time, evening_time, family_contact_name)
  VALUES
    (1, 'Grandma', 72, 'Mysore', 1, '08:00', '18:00', 'Ravi')
`).run();

const patient = db.prepare("SELECT * FROM patient WHERE id = 1").get();
console.log("✅ Seeded patient:", patient);

// ── ring_state (singleton row id=1) ──────────────────────────────────────────
db.prepare(`
  INSERT OR IGNORE INTO ring_state (id, status)
  VALUES (1, 'idle')
`).run();

const rs = db.prepare("SELECT * FROM ring_state WHERE id = 1").get();
console.log("✅ ring_state initialized:", rs);

console.log("\nDatabase path:", db.name);
db.close();
