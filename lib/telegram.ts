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
  replyMarkup?: any,
): Promise<boolean> {
  if (!TELEGRAM_BOT_TOKEN || !chatId) {
    console.warn("[telegram] missing token or chatId — skipping send");
    return false;
  }
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const payload: any = { chat_id: chatId, text, parse_mode: "HTML" };
    if (replyMarkup) {
      payload.reply_markup = replyMarkup;
    }
    const res = await fetch(`${API}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
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

export type PatientMedicationAction =
  | "taken"
  | "not_taken"
  | "skipped"
  | "rescheduled"
  | "other";

export interface PatientMedicationResponseNotification {
  patientName: string;
  patientPhone?: string;
  patientId?: string;
  action: PatientMedicationAction;
  medicineName?: string;
  rawText?: string;
  channel?: "sms" | "telegram" | "voice_call" | "web" | "simulator";
  notes?: string;
  targetChatId?: string;
}

/**
 * Broadcasts an update whenever the user/patient responds to a reminder or medication check:
 * - Taken
 * - Not taken / missed
 * - Skipped
 * - Rescheduled / snoozed
 * - Custom message or note
 *
 * Sends to the configured Telegram bot chat(s) (FAMILY_CHAT_ID, targetChatId, EMERGENCY_CHAT_ID).
 */
export async function notifyPatientMedicationResponse(
  opts: PatientMedicationResponseNotification
): Promise<boolean> {
  const {
    patientName,
    patientPhone,
    action,
    medicineName,
    rawText,
    channel = "sms",
    notes,
    targetChatId,
  } = opts;

  let emoji = "📋";
  let title = "Patient Response Received";
  let actionDescription = rawText || "Response recorded.";

  switch (action) {
    case "taken":
      emoji = "✅";
      title = "Medicine Taken";
      actionDescription = "Patient confirmed medicine has been taken.";
      break;
    case "not_taken":
      emoji = "❌";
      title = "Medicine NOT Taken";
      actionDescription = "Patient reported medicine was NOT taken.";
      break;
    case "skipped":
      emoji = "⏭️";
      title = "Medicine Skipped";
      actionDescription = "Patient chose to skip this medication dose.";
      break;
    case "rescheduled":
      emoji = "⏰";
      title = "Medicine Rescheduled / Snoozed";
      actionDescription = "Patient requested to reschedule/snooze this dose reminder.";
      break;
    case "other":
    default:
      emoji = "💬";
      title = "Patient Response Note";
      actionDescription = rawText || "Patient sent a response.";
      break;
  }

  const channelLabel =
    channel === "sms"
      ? "Twilio SMS 📱"
      : channel === "telegram"
      ? "Telegram Bot 🤖"
      : channel === "voice_call"
      ? "Twilio Phone IVR 📞"
      : channel === "web"
      ? "Web Dashboard 💻"
      : "Simulator 🧪";

  const timeString = new Date().toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });

  const lines = [
    `${emoji} <b>Raksha Update: ${title}</b>`,
    ``,
    `👤 <b>Patient:</b> ${patientName}`,
    patientPhone ? `📞 <b>Phone:</b> <code>${patientPhone}</code>` : "",
    medicineName ? `💊 <b>Medicine:</b> ${medicineName}` : "",
    `📱 <b>Channel:</b> ${channelLabel}`,
    `💬 <b>User Response:</b> "${rawText || action}"`,
    `📝 <b>Status:</b> ${actionDescription}`,
    notes ? `ℹ️ <i>${notes}</i>` : "",
    `🕒 <b>Time:</b> ${timeString}`,
  ].filter(Boolean);

  const formattedMessage = lines.join("\n");

  const targetChats = new Set<string>();
  const famId = FAMILY_CHAT_ID || process.env.FAMILY_CHAT_ID || "8012361167";
  if (famId) targetChats.add(famId);
  if (targetChatId) targetChats.add(targetChatId);
  if (action === "not_taken") {
    const emergId = EMERGENCY_CHAT_ID || process.env.EMERGENCY_CHAT_ID;
    if (emergId) targetChats.add(emergId);
  }

  console.log(`[telegram] Broadcasting patient response (${action}) to chats:`, Array.from(targetChats));

  let anySent = false;
  for (const cid of targetChats) {
    try {
      const ok = await sendTelegram(cid, formattedMessage);
      if (ok) anySent = true;
    } catch (e) {
      console.error(`[telegram] failed to send response notification to chat ${cid}:`, e);
    }
  }

  return anySent;
}
