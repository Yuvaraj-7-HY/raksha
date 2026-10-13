// lib/alerts.ts
// Deduped alert sender.
// 1. INSERT OR IGNORE into alerts_sent — if already there, skip.
// 2. Try n8n first (3 s timeout).
// 3. On failure, fall back to direct Telegram.
// 4. Never throws.

import { getDb } from "./db";
import {
  N8N_ALERT_URL,
  CARE_SHARED_SECRET,
  FAMILY_CHAT_ID,
  EMERGENCY_CHAT_ID,
} from "./config";
import { sendTelegram } from "./telegram";

export type AlertType =
  | "urgent"
  | "precaution"
  | "needs_attention"
  | "resolved"
  | "missed";

/**
 * Send an alert — deduped on (callId, type).
 * @param type     Alert category
 * @param text     Final formatted message text (built by lib/messages.ts)
 * @param callId   Used as the dedupe key
 */
export async function sendAlert(
  type: AlertType,
  text: string,
  callId: string,
): Promise<void> {
  const db = getDb();

  // ── Dedupe: skip if this (callId, type) was already sent ─────────────────
  const insert = db.prepare(`
    INSERT OR IGNORE INTO alerts_sent (call_id, type, sent_at, via)
    VALUES (?, ?, datetime('now'), 'pending')
  `);
  const result = insert.run(callId, type);
  if (result.changes === 0) {
    console.log(`[alerts] deduped — ${type} for ${callId} already sent`);
    return;
  }

  const payload = {
    type,
    level: type === "urgent" ? 3 : type === "needs_attention" ? 2 : 1,
    text,
    callId,
    ts: new Date().toISOString(),
  };

  // ── Try n8n first ─────────────────────────────────────────────────────────
  let via: "n8n" | "direct" = "direct";
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(N8N_ALERT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Care-Secret": CARE_SHARED_SECRET,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
      cache: "no-store",
    });
    clearTimeout(timer);
    if (res.ok) {
      via = "n8n";
      console.log(`[alerts] ${type} sent via n8n`);
    } else {
      throw new Error(`n8n ${res.status}`);
    }
  } catch (err) {
    // ── Fallback: send directly via Telegram Bot API ──────────────────────
    console.warn(
      `[alerts] n8n unavailable (${err instanceof Error ? err.message : err}), falling back to direct Telegram`
    );
    await sendTelegram(FAMILY_CHAT_ID, text);
    if (type === "urgent" && EMERGENCY_CHAT_ID && EMERGENCY_CHAT_ID !== FAMILY_CHAT_ID) {
      await sendTelegram(EMERGENCY_CHAT_ID, text);
    }
    via = "direct";
    console.log(`[alerts] ${type} sent via direct Telegram`);
  }

  // ── Record which channel was actually used ────────────────────────────────
  db.prepare(`
    UPDATE alerts_sent SET via = ? WHERE call_id = ? AND type = ?
  `).run(via, callId, type);
}
