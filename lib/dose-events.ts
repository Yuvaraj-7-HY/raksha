// lib/dose-events.ts
// Server-side event queue for dose status updates triggered by Twilio IVR responses.
// Bridges the server-side webhook (handle-response) ↔ the client-side Today page.

import path from "path";
import fs from "fs";

export type DoseEventType = "taken" | "snoozed" | "missed" | "skipped" | "rescheduled";

export interface DoseEvent {
  id: string;
  doseId: string;
  patientId: string;
  medicineName?: string;
  eventType: DoseEventType;
  /** ISO timestamp when the event was recorded (server time) */
  timestamp: string;
  /** Optional human note, e.g. source of event */
  source?: string;
  /** True once the client has acknowledged this event */
  consumed?: boolean;
}

const EVENTS_FILE = path.join(process.cwd(), "data", "dose_events.json");

function ensureFile() {
  try {
    const dir = path.dirname(EVENTS_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    if (!fs.existsSync(EVENTS_FILE)) {
      fs.writeFileSync(EVENTS_FILE, JSON.stringify([]), "utf-8");
    }
  } catch (err) {
    console.error("[dose-events] Failed to ensure file:", err);
  }
}

function readEvents(): DoseEvent[] {
  try {
    ensureFile();
    const raw = fs.readFileSync(EVENTS_FILE, "utf-8");
    return JSON.parse(raw) as DoseEvent[];
  } catch {
    return [];
  }
}

function writeEvents(events: DoseEvent[]) {
  try {
    ensureFile();
    fs.writeFileSync(EVENTS_FILE, JSON.stringify(events, null, 2), "utf-8");
  } catch (err) {
    console.error("[dose-events] Failed to write events:", err);
  }
}

/** Append a new dose event (e.g. patient pressed 1 → "taken") */
export function appendDoseEvent(
  event: Omit<DoseEvent, "id" | "timestamp" | "consumed">
): DoseEvent {
  const all = readEvents();
  const newEvent: DoseEvent = {
    ...event,
    id: `de_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    timestamp: new Date().toISOString(),
    consumed: false,
  };
  all.push(newEvent);
  // Keep only last 500 events
  const trimmed = all.slice(-500);
  writeEvents(trimmed);
  console.log(`[dose-events] Appended event: doseId=${newEvent.doseId} type=${newEvent.eventType}`);
  return newEvent;
}

/** Get all unconsumed events (optionally for a specific patient) */
export function getPendingDoseEvents(patientId?: string): DoseEvent[] {
  const all = readEvents();
  return all.filter((e) => !e.consumed && (!patientId || e.patientId === patientId));
}

/** Mark a list of event IDs as consumed (called after client acknowledges) */
export function consumeDoseEvents(eventIds: string[]) {
  if (!eventIds.length) return;
  const all = readEvents();
  const updated = all.map((e) =>
    eventIds.includes(e.id) ? { ...e, consumed: true } : e
  );
  writeEvents(updated);
  console.log(`[dose-events] Consumed ${eventIds.length} events: ${eventIds.join(", ")}`);
}
