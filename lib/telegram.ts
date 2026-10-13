// lib/telegram.ts
// Direct Telegram Bot API sender.
// Used as: (1) primary channel during C2 testing, (2) fallback when n8n is down.

import { TELEGRAM_BOT_TOKEN, FAMILY_CHAT_ID, EMERGENCY_CHAT_ID } from "./config";

const API = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

/**
 * Send a plain-text message to a specific chat.
 * Never throws — logs the error and returns false on failure.
 */
export async function sendTelegram(
  chatId: string,
  text: string,
): Promise<boolean> {
  if (!TELEGRAM_BOT_TOKEN || !chatId) {
    console.warn("[telegram] missing token or chatId — skipping send");
    return false;
  }
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(`${API}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) {
      const body = await res.text();
      console.error("[telegram] API error", res.status, body);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[telegram] send failed:", err);
    return false;
  }
}

/** Send to the family chat. */
export async function notifyFamily(text: string): Promise<boolean> {
  return sendTelegram(FAMILY_CHAT_ID, text);
}

/** Send to both family and emergency contact (for urgent alerts). */
export async function notifyUrgent(text: string): Promise<void> {
  await notifyFamily(text);
  if (EMERGENCY_CHAT_ID && EMERGENCY_CHAT_ID !== FAMILY_CHAT_ID) {
    await sendTelegram(EMERGENCY_CHAT_ID, text);
  }
}
