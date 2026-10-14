// lib/conditionDispatcher.ts
// Handles persistence of condition_alerts and dispatches urgent escalations (SMS / Telegram)

import { db } from "./supabaseServer";
import { sendTelegram } from "./telegram";
import twilio from "twilio";
import type { ConditionAlert, ConditionType } from "@/types/conditions";
import { getTodayIst } from "./istDate";

export interface DispatchResult {
  escalated: boolean;
  channel: "sms" | "telegram" | "none";
  error?: string;
}

/**
 * Dispatches an urgent condition alert to the patient's family/caregiver.
 * Enforces: One urgent notification per patient per condition per day.
 * Reuses the escalations table with reason: 'condition_alert'.
 */
export async function dispatchUrgentConditionAlert(opts: {
  patientId: string;
  patientName: string;
  familyPhone: string | null;
  conditionType: ConditionType;
  alertMessage: string;
}): Promise<DispatchResult> {
  const { patientId, patientName, familyPhone, conditionType, alertMessage } = opts;
  const todayIst = getTodayIst();

  console.log(
    `[conditionDispatcher] Evaluating urgent alert for patient=${patientId} condition=${conditionType}`
  );

  try {
    const supabase = db.get();

    // Check if an urgent escalation was already sent today for this patient and condition
    // In escalations table: reason = 'condition_alert'
    const { data: existingEscalations, error: checkError } = await supabase
      .from("escalations")
      .select("id, created_at, sms_sent_to")
      .eq("patient_id", patientId)
      .eq("reason", "condition_alert");

    if (!checkError && existingEscalations) {
      const alreadySentToday = existingEscalations.some((esc: any) => {
        // Compare date in IST
        const dateStr = new Intl.DateTimeFormat("en-CA", {
          timeZone: "Asia/Kolkata",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }).format(new Date(esc.created_at));
        return dateStr === todayIst;
      });

      if (alreadySentToday) {
        console.log(
          `[conditionDispatcher] Urgent notification already sent today for patient=${patientId}. Skipping duplicate.`
        );
        return { escalated: false, channel: "none" };
      }
    }

    // Message payload: Calm, clear, no medical advice/diagnosis
    const smsText = `Raksha Urgent Alert for ${patientName}: ${alertMessage} Please check on them immediately.`;

    let channel: "sms" | "telegram" | "none" = "none";
    let recipient = familyPhone || "caregiver";

    // 1. Try SMS via Twilio
    if (familyPhone && process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
      try {
        const twilioClient = twilio(
          process.env.TWILIO_ACCOUNT_SID,
          process.env.TWILIO_AUTH_TOKEN
        );
        const fromNumber =
          process.env.TWILIO_PHONE_NUMBER || process.env.TWILIO_FROM_NUMBER;
        const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID;

        const sendOpts: any = {
          to: familyPhone,
          body: smsText,
        };
        if (messagingServiceSid) {
          sendOpts.messagingServiceSid = messagingServiceSid;
        } else if (fromNumber) {
          sendOpts.from = fromNumber;
        }

        if (sendOpts.messagingServiceSid || sendOpts.from) {
          const res = await twilioClient.messages.create(sendOpts);
          console.log(`[conditionDispatcher] SMS sent successfully. SID=${res.sid}`);
          channel = "sms";
        }
      } catch (smsErr) {
        console.warn("[conditionDispatcher] Twilio SMS failed, trying Telegram fallback:", smsErr);
      }
    }

    // 2. Fallback to Telegram if SMS was not sent
    if (channel === "none" && process.env.TELEGRAM_BOT_TOKEN) {
      const chatId = process.env.EMERGENCY_CHAT_ID || process.env.FAMILY_CHAT_ID;
      if (chatId) {
        const tgOk = await sendTelegram(
          chatId,
          `🚨 <b>Raksha Urgent Condition Alert</b>\n\nPatient: <b>${patientName}</b>\nCondition: <b>${conditionType.toUpperCase()}</b>\n\n${alertMessage}\n\n<i>Please check on the patient immediately.</i>`
        );
        if (tgOk) {
          channel = "telegram";
          recipient = `Telegram:${chatId}`;
        }
      }
    }

    // 3. Record escalation row in Supabase
    const { error: insertError } = await supabase.from("escalations").insert({
      patient_id: patientId,
      reason: "condition_alert",
      sms_sent_to: recipient,
    });

    if (insertError) {
      console.warn("[conditionDispatcher] escalations insert note:", insertError.message);
    }

    return { escalated: channel !== "none", channel };
  } catch (err: any) {
    console.error("[conditionDispatcher] Error during urgent dispatch:", err);
    return { escalated: false, channel: "none", error: err.message };
  }
}
