// lib/config.ts
// Server-side constants only — never import NEXT_PUBLIC_* vars here.

import path from "path";

// ── LLM ──────────────────────────────────────────────────────────────────────
export const GROQ_API_KEY = process.env.GROQ_API_KEY ?? "";
export const GROQ_MODEL =
  process.env.GROQ_MODEL ?? "llama-3.1-8b-instant";

// ── Telegram ──────────────────────────────────────────────────────────────────
export const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? "";
export const FAMILY_CHAT_ID = process.env.FAMILY_CHAT_ID ?? "";
export const EMERGENCY_CHAT_ID =
  process.env.EMERGENCY_CHAT_ID ?? FAMILY_CHAT_ID;

// ── n8n alert router ──────────────────────────────────────────────────────────
export const N8N_ALERT_URL =
  process.env.N8N_ALERT_URL ??
  "http://localhost:5678/webhook-test/care-alert";
export const N8N_BASE_URL = process.env.N8N_BASE_URL ?? "http://localhost:5678";
export const N8N_WEBHOOK_PREFIX = process.env.N8N_WEBHOOK_PREFIX ?? "webhook";
export const CARE_SHARED_SECRET =
  process.env.CARE_SHARED_SECRET ?? "change-me";

// ── Call behaviour ────────────────────────────────────────────────────────────
export const RING_TIMEOUT_SECONDS = Number(
  process.env.RING_TIMEOUT_SECONDS ?? 30
);

// ── Scheduling ────────────────────────────────────────────────────────────────
/** Delay before a follow-up call after a level-2 concern (seconds). */
export const FOLLOWUP_DELAY_SECONDS = Number(
  process.env.FOLLOWUP_DELAY_SECONDS ?? 120
);
/** Delay between missed-call retry attempts (seconds). */
export const RETRY_INTERVAL_SECONDS = Number(
  process.env.RETRY_INTERVAL_SECONDS ?? 30
);
/** Maximum missed / declined attempts before sending the "missed" alert. */
export const MAX_MISSED_ATTEMPTS = Number(
  process.env.MAX_MISSED_ATTEMPTS ?? 3
);
/** Maximum follow-up calls per original concern. */
export const MAX_FOLLOWUPS_PER_CONCERN = Number(
  process.env.MAX_FOLLOWUPS_PER_CONCERN ?? 2
);
/** Max AI turns before the call is wrapped up automatically. */
export const MAX_CALL_TURNS = Number(process.env.MAX_CALL_TURNS ?? 8);

// ── Worker / dispatcher ───────────────────────────────────────────────────────
/** How often the dispatcher loop runs (ms). */
export const DISPATCH_INTERVAL_MS = Number(
  process.env.DISPATCH_INTERVAL_MS ?? 5000
);
/** If ring_state has been "ringing" longer than this, treat it as missed. */
export const STALE_RING_SECONDS = Number(
  process.env.STALE_RING_SECONDS ?? 60
);

// ── Twilio ────────────────────────────────────────────────────────────────────
export const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID ?? "";
export const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN ?? "";
export const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER ?? "";
export const TWILIO_MESSAGING_SERVICE_SID =
  process.env.TWILIO_MESSAGING_SERVICE_SID ?? "";
/** Base URL for Twilio voice webhooks. Set to your ngrok/prod URL. */
export const TWILIO_WEBHOOK_BASE_URL =
  process.env.TWILIO_WEBHOOK_BASE_URL ?? "";

// ── Database ──────────────────────────────────────────────────────────────────
export const DB_PATH = path.join(process.cwd(), "data", "raksha.db");

// ── Twilio / Transport ────────────────────────────────────────────────────────
export const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID ?? "";
export const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN ?? "";
export const TWILIO_FROM_NUMBER = process.env.TWILIO_FROM_NUMBER ?? "";
export const ALLOWED_TO_NUMBERS = process.env.ALLOWED_TO_NUMBERS ?? "";
export const DEFAULT_TO_NUMBER = process.env.DEFAULT_TO_NUMBER ?? "";
export const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL ?? "";
export const TRANSPORT = (process.env.TRANSPORT ?? "twilio") as "twilio" | "web";
export const TWILIO_VALIDATE = process.env.TWILIO_VALIDATE !== "false";

// ── Emergency keywords (case-insensitive substring match) ────────────────────
export const EMERGENCY_KEYWORDS: string[] = [
  "fell",
  "fallen",
  "can't get up",
  "cannot get up",
  "can't stand",
  "chest pain",
  "can't breathe",
  "cannot breathe",
  "trouble breathing",
  "unconscious",
  "bleeding",
  "help me",
  "stroke",
  "severe pain",
  "heart attack",
  "not moving",
  "passed out",
  "fainted",
];
