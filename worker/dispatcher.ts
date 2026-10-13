// worker/dispatcher.ts
// Dispatcher worker — runs as a separate process alongside `next dev`.
// Full scheduling logic will be added in milestone C5.
// For now: just keeps the process alive and logs a heartbeat.

import { getDb } from "../lib/db";
import { DISPATCH_INTERVAL_MS } from "../lib/config";

console.log("[dispatcher] starting — interval", DISPATCH_INTERVAL_MS, "ms");

// Verify DB opens correctly.
const db = getDb();
const patient = db.prepare("SELECT name FROM patient WHERE id = 1").get() as
  | { name: string }
  | undefined;
console.log(
  "[dispatcher] DB ok — patient:",
  patient?.name ?? "(not seeded yet)"
);

// Placeholder loop — replaced in C5.
setInterval(() => {
  // TODO C5: stale ring sweep + dispatch pending followups
}, DISPATCH_INTERVAL_MS);

console.log("[dispatcher] ready (C5 logic pending)");
