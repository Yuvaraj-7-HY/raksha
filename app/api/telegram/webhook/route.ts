// app/api/telegram/webhook/route.ts
// Receives Telegram bot webhook updates (text messages "1"/"2" or inline keyboard callbacks)

import { NextRequest, NextResponse } from "next/server";
import {
  getLatestMedicationCheck,
  getMedicationChecks,
  upsertMedicationCheck,
} from "@/lib/medication-checks";
import { appendDoseEvent } from "@/lib/dose-events";
import { scheduleCaregiverAlert } from "@/lib/familyAlert";
import { sendTelegram } from "@/lib/telegram";

export async function POST(req: NextRequest) {
  try {
    const update = await req.json().catch(() => ({}));
    console.log("[telegram/webhook] Incoming Telegram update:", JSON.stringify(update));

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

    if (!callbackData && !messageText) {
      return NextResponse.json({ ok: true });
    }

    // Answer callback query quickly if present
    if (callbackQueryId && process.env.TELEGRAM_BOT_TOKEN) {
      fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ callback_query_id: callbackQueryId }),
      }).catch(() => {});
    }

    let isTaken = false;
    let isNotTaken = false;
    let isSkip = false;
    let isReschedule = false;
    let isOther = false;
    let checkId = "";
    let patientId = "";

    if (callbackData) {
      // Format: "taken:checkId:patientId", "not_taken:...", "skip:...", "reschedule:..."
      const parts = callbackData.split(":");
      const action = parts[0];
      checkId = parts[1] || "";
      patientId = parts[2] || "";

      if (action === "taken") isTaken = true;
      else if (action === "not_taken") isNotTaken = true;
      else if (action === "skip") isSkip = true;
      else if (action === "reschedule") isReschedule = true;
      else isOther = true;
    } else if (messageText) {
      const lower = messageText.toLowerCase();
      if (lower === "1" || lower.startsWith("1") || lower.includes("taken") || lower.includes("yes") || lower.includes("took")) {
        isTaken = true;
      } else if (lower === "2" || lower.startsWith("2") || lower.includes("not taken") || lower.includes("no") || lower.includes("haven't")) {
        isNotTaken = true;
      } else if (lower === "3" || lower.startsWith("3") || lower.includes("skip") || lower.includes("skipped")) {
        isSkip = true;
      } else if (lower === "4" || lower.startsWith("4") || lower.includes("reschedule") || lower.includes("snooze") || lower.includes("later")) {
        isReschedule = true;
      } else {
        isOther = true;
      }
    }

    // If checkId wasn't in callback data, find latest pending check
    if (!checkId) {
      const all = getMedicationChecks();
      const pending = all.find((c) => c.response === "Pending" || c.response === "pending");
      if (pending) {
        checkId = pending.id;
        patientId = pending.patientId;
      } else if (patientId) {
        const latest = getLatestMedicationCheck(patientId);
        if (latest) checkId = latest.id;
      }
    }

    const { notifyPatientMedicationResponse } = await import("@/lib/telegram");

    if (isTaken) {
      console.log(`[telegram/webhook] Patient confirmed medicine TAKEN (checkId: ${checkId})`);
      const updated = upsertMedicationCheck(checkId, patientId, {
        status: "completed",
        response: "Taken",
        digits: "1",
        notes: `Confirmed via Telegram (Taken)`,
      });

      if (updated?.doseId) {
        appendDoseEvent({
          doseId: updated.doseId,
          patientId: updated.patientId,
          eventType: "taken",
          medicineName: updated.medicineName,
          source: "telegram_reply_1",
        });
      }

      await notifyPatientMedicationResponse({
        patientName: updated?.patientName || "Patient",
        patientPhone: updated?.phone,
        patientId,
        action: "taken",
        medicineName: updated?.medicineName,
        rawText: messageText || "1 - Taken",
        channel: "telegram",
        notes: "Confirmed via Telegram interaction",
      });

      if (chatId) {
        await sendTelegram(chatId, "✅ <b>Raksha:</b> Thank you! We have recorded that you took your medicine.");
      }
    } else if (isNotTaken) {
      console.log(`[telegram/webhook] Patient reported medicine NOT TAKEN (checkId: ${checkId})`);
      const updated = upsertMedicationCheck(checkId, patientId, {
        status: "completed",
        response: "Not Taken",
        digits: "2",
        notes: `Reported via Telegram (Not Taken). Caregiver alerted.`,
      });

      if (patientId || updated?.patientId) {
        scheduleCaregiverAlert({
          patientId: patientId || updated?.patientId || "",
          reason: "missed_dose_reported",
          customMessage: `Raksha Alert: ${updated?.patientName || "Patient"} reported via Telegram that they have not taken their medicine today. Please check in with them.`,
          delayMs: 30_000,
        });
      }

      await notifyPatientMedicationResponse({
        patientName: updated?.patientName || "Patient",
        patientPhone: updated?.phone,
        patientId,
        action: "not_taken",
        medicineName: updated?.medicineName,
        rawText: messageText || "2 - Not Taken",
        channel: "telegram",
        notes: "Reported via Telegram interaction. Caregiver alerted.",
      });

      if (chatId) {
        await sendTelegram(chatId, "⚠️ <b>Raksha:</b> Thank you for letting us know. Please take your medicine as advised. Your caregiver has been alerted.");
      }
    } else if (isSkip) {
      console.log(`[telegram/webhook] Patient reported dose SKIPPED (checkId: ${checkId})`);
      const updated = upsertMedicationCheck(checkId, patientId, {
        status: "completed",
        response: "Skipped",
        digits: "3",
        notes: `Reported via Telegram (Skipped dose)`,
      });

      if (updated?.doseId) {
        appendDoseEvent({
          doseId: updated.doseId,
          patientId: updated.patientId,
          eventType: "skipped",
          medicineName: updated.medicineName,
          source: "telegram_reply_skip",
        });
      }

      await notifyPatientMedicationResponse({
        patientName: updated?.patientName || "Patient",
        patientPhone: updated?.phone,
        patientId,
        action: "skipped",
        medicineName: updated?.medicineName,
        rawText: messageText || "3 - Skip",
        channel: "telegram",
        notes: "Dose skipped by patient",
      });

      if (chatId) {
        await sendTelegram(chatId, "⏭️ <b>Raksha:</b> Noted! We have recorded that you skipped this dose.");
      }
    } else if (isReschedule) {
      console.log(`[telegram/webhook] Patient requested RESCHEDULE / SNOOZE (checkId: ${checkId})`);
      const updated = upsertMedicationCheck(checkId, patientId, {
        status: "completed",
        response: "Rescheduled",
        digits: "4",
        notes: `Reported via Telegram (Rescheduled / Snoozed)`,
      });

      if (updated?.doseId) {
        appendDoseEvent({
          doseId: updated.doseId,
          patientId: updated.patientId,
          eventType: "rescheduled",
          medicineName: updated.medicineName,
          source: "telegram_reply_reschedule",
        });
      }

      await notifyPatientMedicationResponse({
        patientName: updated?.patientName || "Patient",
        patientPhone: updated?.phone,
        patientId,
        action: "rescheduled",
        medicineName: updated?.medicineName,
        rawText: messageText || "4 - Reschedule",
        channel: "telegram",
        notes: "Reminder snoozed for later",
      });

      if (chatId) {
        await sendTelegram(chatId, "⏰ <b>Raksha:</b> Understood! We have snoozed your reminder and will follow up later.");
      }
    } else if (messageText && chatId) {
      const all = getMedicationChecks(patientId || undefined);
      const latest = all[0];
      const updated = latest ? upsertMedicationCheck(latest.id, latest.patientId, {
        notes: `Telegram message from patient: "${messageText}"`,
      }) : null;

      await notifyPatientMedicationResponse({
        patientName: updated?.patientName || "Patient",
        patientPhone: updated?.phone,
        patientId,
        action: "other",
        rawText: messageText,
        channel: "telegram",
        notes: "Incoming message from patient",
      });

      await sendTelegram(chatId, "Raksha: Thank you for your message. Reply <b>1</b> (Taken), <b>2</b> (Not Taken), <b>3</b> (Skip), or <b>4</b> (Reschedule).");
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("[telegram/webhook] Error handling telegram update:", err);
    return NextResponse.json({ ok: false, error: err?.message }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ ok: true, status: "Telegram webhook active" });
}
