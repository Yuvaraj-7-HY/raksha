// lib/telegramPoller.ts
// Long-polling worker for Telegram Bot updates.
// Enables instantaneous receiving of inline button clicks and text replies
// directly in local development without needing a public ngrok webhook!

import { TELEGRAM_BOT_TOKEN } from "./config";
import { handleTelegramAction, sendTelegramMedicationCheck } from "./telegramCare";
import { sendTelegram } from "./telegram";
import { db } from "./supabaseServer";

let isPolling = false;
let lastOffset = 0;
let abortController: AbortController | null = null;

export async function processTelegramUpdate(update: any) {
  try {
    let callbackData: string | undefined;
    let messageText: string | undefined;
    let chatId: string | undefined;
    let callbackQueryId: string | undefined;

    if (update.callback_query) {
      callbackQueryId = update.callback_query.id;
      callbackData = update.callback_query.data;
      chatId = String(update.callback_query.message?.chat?.id || "");
    } else if (update.message) {
      messageText = (update.message.text || "").trim();
      chatId = String(update.message.chat?.id || "");
    }

    if (!chatId || (!callbackData && !messageText)) return;

    // Answer callback query so Telegram UI stops spinning
    if (callbackQueryId && TELEGRAM_BOT_TOKEN) {
      fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ callback_query_id: callbackQueryId }),
      }).catch(() => {});
    }

    // Handle commands
    if (messageText) {
      const lower = messageText.toLowerCase();
      if (lower === "/start") {
        await sendTelegram(
          chatId,
          `👋 <b>Welcome to Raksha Elderly Care!</b>\n\n` +
          `You will receive automated medication reminders with interactive buttons here.\n\n` +
          `• Press <b>Yes</b> or reply <b>1</b> if you took your medicine.\n` +
          `• Press <b>No</b> or reply <b>2</b> if you haven't taken it.\n` +
          `• Type <b>/check</b> anytime to trigger a test medication check!\n` +
          `• Type <b>/history</b> or <b>/calls</b> to view recent call logs.`
        );
        return;
      }
      if (lower === "/check" || lower === "/test") {
        await sendTelegram(chatId, `🚀 <i>Triggering medication check prompt...</i>`);
        await sendTelegramMedicationCheck({
          patientId: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
          chatId,
        });
        return;
      }
      if (lower === "/history" || lower === "/calls") {
        try {
          const supabase = db.get();
          const { data: calls, error: callsErr } = await supabase
            .from("call_attempts")
            .select("id, attempt_number, outcome, is_recheck, created_at, patient_id")
            .order("created_at", { ascending: false })
            .limit(6);

          if (callsErr || !calls || calls.length === 0) {
            await sendTelegram(
              chatId,
              `📞 <b>Raksha Call History:</b>\n\nNo voice call records found in database.`
            );
            return;
          }

          // Fetch patient names for these IDs
          const patientIds = Array.from(new Set(calls.map((c: any) => c.patient_id).filter(Boolean)));
          const { data: patients } = await supabase
            .from("patients")
            .select("id, name")
            .in("id", patientIds);

          const patientMap = new Map((patients || []).map((p: any) => [p.id, p.name]));

          const callLines = calls.map((c: any, idx: number) => {
            const pName = patientMap.get(c.patient_id) || "Patient";
            const isSuccess = c.outcome === "yes" || c.outcome === "completed";
            const isNo = c.outcome === "no";
            const statusEmoji = isSuccess ? "✅" : isNo ? "❌" : "⚠️";
            const dateStr = new Date(c.created_at).toLocaleString("en-IN", {
              timeZone: "Asia/Kolkata",
              day: "numeric",
              month: "short",
              hour: "2-digit",
              minute: "2-digit",
            });
            return (
              `<b>${idx + 1}.</b> ${statusEmoji} <b>${pName}</b> (Attempt #${c.attempt_number || 1}${c.is_recheck ? " · Re-check" : ""})\n` +
              `   • Status: <b>${c.outcome.toUpperCase()}</b>\n` +
              `   • Time: ${dateStr} IST`
            );
          });

          await sendTelegram(
            chatId,
            `📞 <b>Raksha Recent Call History (${calls.length})</b>\n\n` +
            `${callLines.join("\n\n")}\n\n` +
            `<i>Use /check to trigger an interactive check-in call.</i>`
          );
        } catch (err: any) {
          console.error("[telegramPoller] /history error:", err);
          await sendTelegram(chatId, `⚠️ Unable to load call history: ${err.message}`);
        }
        return;
      }
    }

    // Determine action from callback data or message text
    let action: "taken" | "not_taken" | "remind" | null = null;
    let checkId: string | undefined;
    let patientId: string | undefined;
    let attemptNo = 1;

    if (callbackData) {
      // Format: "taken:checkId:patientId:attemptNo"
      const parts = callbackData.split(":");
      const rawAction = parts[0];
      checkId = parts[1];
      patientId = parts[2];
      attemptNo = Number(parts[3] || 1);

      if (rawAction === "taken") action = "taken";
      else if (rawAction === "not_taken") action = "not_taken";
      else if (rawAction === "remind" || rawAction === "snooze" || rawAction === "skip") action = "remind";
    } else if (messageText) {
      const lower = messageText.toLowerCase();
      if (
        lower === "1" ||
        lower.startsWith("1") ||
        lower.includes("yes") ||
        lower.includes("taken") ||
        lower.includes("took") ||
        lower.includes("done")
      ) {
        action = "taken";
      } else if (
        lower === "2" ||
        lower.startsWith("2") ||
        lower.includes("no") ||
        lower.includes("haven't") ||
        lower.includes("not taken") ||
        lower.includes("not yet")
      ) {
        action = "not_taken";
      } else if (
        lower === "3" ||
        lower.startsWith("3") ||
        lower.includes("remind") ||
        lower.includes("later") ||
        lower.includes("snooze")
      ) {
        action = "remind";
      }
    }

    if (action) {
      console.log(`[telegramPoller] Processing action '${action}' from chat ${chatId} (attempt: ${attemptNo})...`);
      await handleTelegramAction({
        action,
        checkId,
        patientId,
        attemptNo,
        chatId,
        rawText: messageText || callbackData,
      });
    } else if (messageText) {
      await sendTelegram(
        chatId,
        `ℹ️ <b>Raksha:</b> Please select an option using the buttons above, or reply:\n` +
        `• <b>1</b> for Yes (Taken)\n` +
        `• <b>2</b> for No (Not yet)\n` +
        `• <b>3</b> for Remind in 1 min`
      );
    }
  } catch (err) {
    console.error("[telegramPoller] Error processing update:", err);
  }
}

/**
 * Start long-polling in the background. Safe to call multiple times.
 */
export function startTelegramPoller() {
  if (isPolling) return;
  if (!TELEGRAM_BOT_TOKEN) {
    console.warn("[telegramPoller] No TELEGRAM_BOT_TOKEN; poller not started.");
    return;
  }

  isPolling = true;
  abortController = new AbortController();

  console.log("[telegramPoller] 🟢 Telegram polling worker started.");

  (async () => {
    while (isPolling) {
      try {
        const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getUpdates?offset=${lastOffset}&timeout=10`;
        const res = await fetch(url, { signal: abortController?.signal });
        if (!res.ok) {
          await new Promise((r) => setTimeout(r, 3000));
          continue;
        }

        const data: any = await res.json();
        if (data.ok && Array.isArray(data.result)) {
          for (const update of data.result) {
            lastOffset = update.update_id + 1;
            void processTelegramUpdate(update);
          }
        }
      } catch (err: any) {
        if (err?.name === "AbortError") break;
        await new Promise((r) => setTimeout(r, 3000));
      }
    }
    console.log("[telegramPoller] 🔴 Telegram polling worker stopped.");
  })();
}

export function stopTelegramPoller() {
  isPolling = false;
  if (abortController) {
    abortController.abort();
    abortController = null;
  }
}
