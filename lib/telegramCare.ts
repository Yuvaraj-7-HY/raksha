// lib/telegramCare.ts
// Complete Telegram Medication Adherence Care System
// Handles:
// 1. Interactive Telegram medication check prompts with inline buttons (Yes/No/Remind)
// 2. Automated 1-minute follow-up if user replies "No" (Attempt 1 -> Attempt 2 -> Escalation)
// 3. Automated 1-minute follow-up if user DOES NOT reply (unanswered timeout -> retry -> escalation)
// 4. Persistence to Supabase (call_attempts, patients, escalations) and local medication_checks store

import { db } from "./supabaseServer";
import {
  sendTelegram,
  notifyPatientMedicationResponse,
  notifyUrgent,
} from "./telegram";
import {
  FAMILY_CHAT_ID,
  EMERGENCY_CHAT_ID,
  TELEGRAM_BOT_TOKEN,
} from "./config";
import { scheduleCaregiverAlert } from "./familyAlert";
import {
  upsertMedicationCheck,
  getMedicationChecks,
} from "./medication-checks";
import { appendDoseEvent } from "./dose-events";

export interface TelegramSession {
  checkId: string;
  patientId: string;
  patientName: string;
  patientPhone?: string;
  chatId: string;
  attemptNo: number;
  status: "pending" | "answered_yes" | "answered_no" | "escalated";
  createdAt: number;
  unansweredTimer?: NodeJS.Timeout;
}

// Global active sessions map
type GlobalWithTelegramSessions = typeof globalThis & {
  __telegramCareSessions?: Map<string, TelegramSession>;
};

function getSessionsMap(): Map<string, TelegramSession> {
  const g = globalThis as GlobalWithTelegramSessions;
  if (!g.__telegramCareSessions) {
    g.__telegramCareSessions = new Map<string, TelegramSession>();
  }
  return g.__telegramCareSessions;
}

/**
 * Initiates an interactive Telegram medication check.
 */
export async function sendTelegramMedicationCheck(opts: {
  patientId: string;
  patientName?: string;
  attemptNo?: number;
  chatId?: string;
  attemptId?: string;
  isFollowup?: boolean;
}): Promise<{ ok: boolean; checkId: string; messageId?: number }> {
  const {
    patientId,
    attemptNo = 1,
    chatId = FAMILY_CHAT_ID || "8012361167",
    isFollowup = false,
  } = opts;

  let patientName = opts.patientName || "Patient";
  let patientPhone = "";

  // 1. Look up patient details from Supabase if needed
  try {
    const supabase = db.get();
    const { data: p } = await supabase
      .from("patients")
      .select("id, name, phone")
      .eq("id", patientId)
      .single();
    if (p) {
      patientName = p.name || patientName;
      patientPhone = p.phone || "";
    }
  } catch (err) {
    console.warn("[telegramCare] Patient lookup note:", err);
  }

  const checkId = opts.attemptId || `tg_chk_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

  // 2. Record check in medication_checks store
  upsertMedicationCheck(checkId, patientId, {
    patientName,
    phone: patientPhone,
    status: "calling",
    response: "Pending",
    channel: "telegram",
    notes: isFollowup
      ? `Telegram Follow-up Check (Attempt ${attemptNo})`
      : `Telegram Medication Check (Attempt ${attemptNo})`,
  });

  // 3. Insert into Supabase call_attempts
  try {
    const supabase = db.get();
    await supabase.from("call_attempts").insert({
      id: checkId.includes("-") && checkId.length === 36 ? checkId : undefined,
      patient_id: patientId,
      attempt_number: attemptNo,
      outcome: "unclear",
      twilio_call_sid: `tg_${checkId}`,
      is_recheck: attemptNo > 1,
    });
  } catch (e) {
    console.warn("[telegramCare] Supabase call_attempts insert note:", e);
  }

  // 4. Construct interactive message with inline keyboard
  const header = isFollowup
    ? `🔔 <b>Raksha Follow-up Check (Attempt ${attemptNo}/2)</b>`
    : `💊 <b>Raksha Medication Check</b>`;

  const bodyText = isFollowup
    ? `Hello <b>${patientName}</b>!\n\nIt has been 1 minute. Have you taken your prescribed medicine now?\n\nPlease choose an option below:`
    : `Hello <b>${patientName}</b>!\n\nHave you taken your prescribed medicines today?\n\nPlease choose an option below or reply:`;

  const text = `${header}\n\n${bodyText}\n\n1️⃣ <b>Yes, taken</b>\n2️⃣ <b>No, not yet</b>\n3️⃣ <b>Remind in 1 min</b>`;

  const inlineKeyboard = {
    inline_keyboard: [
      [
        {
          text: "✅ 1. Yes, taken",
          callback_data: `taken:${checkId}:${patientId}:${attemptNo}`,
        },
        {
          text: attemptNo > 1 ? "❌ 2. Still No" : "❌ 2. No, not yet",
          callback_data: `not_taken:${checkId}:${patientId}:${attemptNo}`,
        },
      ],
      [
        {
          text: "⏰ 3. Remind in 1 min",
          callback_data: `remind:${checkId}:${patientId}:${attemptNo}`,
        },
      ],
    ],
  };

  console.log(`[telegramCare] Sending interactive medication check to chat ${chatId} for ${patientName} (Attempt ${attemptNo})...`);
  const sent = await sendTelegram(chatId, text, inlineKeyboard);

  // 5. Register session
  const sessions = getSessionsMap();
  const session: TelegramSession = {
    checkId,
    patientId,
    patientName,
    patientPhone,
    chatId,
    attemptNo,
    status: "pending",
    createdAt: Date.now(),
  };

  // 6. Set 1-minute UNANSWERED timeout
  // If the user doesn't reply or click any option within 60s, follow up automatically!
  session.unansweredTimer = setTimeout(async () => {
    await handleUnansweredTimeout(checkId);
  }, 60_000); // 1 minute (60,000 ms)

  sessions.set(checkId, session);
  sessions.set(patientId, session); // Also index by patientId for fast lookup

  return { ok: sent, checkId };
}

/**
 * Handles 1-minute timeout when user DOES NOT REPLY to a prompt
 */
async function handleUnansweredTimeout(checkId: string) {
  const sessions = getSessionsMap();
  const session = sessions.get(checkId);
  if (!session || session.status !== "pending") return;

  console.log(`[telegramCare] ⏰ 1 minute elapsed with NO REPLY for check ${checkId} (Attempt ${session.attemptNo})`);

  if (session.attemptNo === 1) {
    // Attempt 1 -> Send follow-up prompt
    session.status = "answered_no"; // Mark previous as expired
    await sendTelegram(
      session.chatId,
      `⏰ <b>Raksha Reminder (No Response Received):</b>\n\nWe haven't received your response yet for <b>${session.patientName}</b>. Did you take your medicines today?\n\n<i>Sending follow-up check now...</i>`
    );

    // Trigger Attempt 2 follow-up
    await sendTelegramMedicationCheck({
      patientId: session.patientId,
      patientName: session.patientName,
      attemptNo: 2,
      chatId: session.chatId,
      isFollowup: true,
    });
  } else {
    // Attempt 2 expired with NO reply -> Escalate!
    session.status = "escalated";
    console.log(`[telegramCare] 🚨 Two consecutive attempts UNANSWERED for ${session.patientName}. Escalating to caregiver!`);

    await sendTelegram(
      session.chatId,
      `🚨 <b>Raksha Alert:</b> No response received after 2 attempts for <b>${session.patientName}</b>. An alert has been sent to your caregiver.`
    );

    // Supabase update & escalation
    try {
      const supabase = db.get();
      await supabase.from("escalations").insert({
        patient_id: session.patientId,
        sms_sent_to: session.chatId,
        message: `Raksha Alert: No response received from ${session.patientName} after multiple medication check reminders.`,
        reason: "no_response",
      });

      await supabase
        .from("patients")
        .update({ status: "no", recheck_pending: false })
        .eq("id", session.patientId);
    } catch (e) {
      console.warn("[telegramCare] Escalation insert note:", e);
    }

    scheduleCaregiverAlert({
      patientId: session.patientId,
      reason: "missed_dose_reported",
      customMessage: `Raksha Emergency: ${session.patientName} did not respond to multiple medication reminders today. Please check in immediately.`,
      delayMs: 0,
    });

    await notifyUrgent(
      `🚨 <b>RAKSHA EMERGENCY: UNRESPONSIVE PATIENT</b>\n\n` +
      `👤 <b>Patient:</b> ${session.patientName}\n` +
      `⚠️ <b>Alert:</b> 2 consecutive medication checks expired without response.\n` +
      `🕒 <b>Time:</b> ${new Date().toLocaleTimeString("en-IN")}\n` +
      `📞 Caregiver dispatch initiated.`
    );
  }
}

/**
 * Handles user interaction (inline button click or direct text reply)
 */
export async function handleTelegramAction(opts: {
  action: "taken" | "not_taken" | "remind";
  checkId?: string;
  patientId?: string;
  attemptNo?: number;
  chatId: string;
  rawText?: string;
}): Promise<{ ok: boolean; responseMessage: string }> {
  const { chatId, rawText } = opts;
  const sessions = getSessionsMap();

  // Find active session
  let session = (opts.checkId && sessions.get(opts.checkId)) ||
                (opts.patientId && sessions.get(opts.patientId)) ||
                Array.from(sessions.values()).reverse().find((s) => s.status === "pending" || s.chatId === chatId);

  const patientId = opts.patientId || session?.patientId || "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
  const checkId = opts.checkId || session?.checkId || `tg_${Date.now()}`;
  const attemptNo = opts.attemptNo || session?.attemptNo || 1;
  const patientName = session?.patientName || "Patient";

  // Clear unanswered timer
  if (session?.unansweredTimer) {
    clearTimeout(session.unansweredTimer);
    session.unansweredTimer = undefined;
  }

  const supabase = db.get();

  // ── CASE 1: TAKEN (YES) ───────────────────────────────────────────────────
  if (opts.action === "taken") {
    if (session) session.status = "answered_yes";

    console.log(`[telegramCare] ✅ Patient confirmed TAKEN (patient: ${patientId}, attempt: ${attemptNo})`);

    // 1. Update Supabase
    try {
      await supabase
        .from("patients")
        .update({
          status: "yes",
          recheck_pending: false,
          recheck_due_at: null,
        })
        .eq("id", patientId);

      await supabase.from("call_attempts").insert({
        patient_id: patientId,
        attempt_number: attemptNo,
        outcome: "yes",
        raw_digits: "1",
        twilio_call_sid: `tg_ans_${Date.now()}`,
        is_recheck: attemptNo > 1,
      });
    } catch (e) {
      console.warn("[telegramCare] DB update yes note:", e);
    }

    // 2. Update local medication checks & dose events
    upsertMedicationCheck(checkId, patientId, {
      status: "completed",
      response: "Taken",
      digits: "1",
      notes: `Confirmed via Telegram (${attemptNo > 1 ? "Follow-up" : "First check"})`,
    });

    appendDoseEvent({
      doseId: `dose_${Date.now()}`,
      patientId,
      eventType: "taken",
      source: "telegram_button_1",
    });

    // 3. Send Telegram response to patient/user
    const reply = `✅ <b>Raksha:</b> Wonderful! Thank you for confirming. We have recorded that your medicine was taken. Have a healthy day! 🌟`;
    await sendTelegram(chatId, reply);

    // 4. Notify family / caregiver
    await notifyPatientMedicationResponse({
      patientName,
      patientId,
      action: "taken",
      rawText: rawText || "1 - Medicine Taken",
      channel: "telegram",
      notes: attemptNo > 1 ? "Confirmed during 1-min follow-up" : "Confirmed on initial Telegram check",
      targetChatId: chatId,
    });

    return { ok: true, responseMessage: reply };
  }

  // ── CASE 2: NOT TAKEN (NO) ───────────────────────────────────────────────
  if (opts.action === "not_taken") {
    if (session) session.status = "answered_no";

    console.log(`[telegramCare] ❌ Patient reported NOT TAKEN (patient: ${patientId}, attempt: ${attemptNo})`);

    // Record attempt
    try {
      await supabase.from("call_attempts").insert({
        patient_id: patientId,
        attempt_number: attemptNo,
        outcome: "no",
        raw_digits: "2",
        twilio_call_sid: `tg_no_${Date.now()}`,
        is_recheck: attemptNo > 1,
      });
    } catch (e) {
      console.warn("[telegramCare] DB insert no note:", e);
    }

    upsertMedicationCheck(checkId, patientId, {
      status: "completed",
      response: "Not Taken",
      digits: "2",
      notes: `Reported NOT taken via Telegram (Attempt ${attemptNo})`,
    });

    if (attemptNo === 1) {
      // ── ATTEMPT 1: Notify user and SCHEDULE 1-MINUTE FOLLOW-UP ────────────
      const dueAt = new Date(Date.now() + 60_000).toISOString();
      try {
        await supabase
          .from("patients")
          .update({
            status: "no",
            recheck_pending: true,
            recheck_due_at: dueAt,
          })
          .eq("id", patientId);
      } catch (e) {
        console.warn("[telegramCare] Patient recheck flag note:", e);
      }

      const reply = `⚠️ <b>Raksha:</b> Thank you for letting us know.\n\nPlease take your prescribed medicine now as advised by your doctor.\n\n⏰ <b>We will send you a follow-up check in 1 minute.</b>`;
      await sendTelegram(chatId, reply);

      await notifyPatientMedicationResponse({
        patientName,
        patientId,
        action: "not_taken",
        rawText: rawText || "2 - Not Taken",
        channel: "telegram",
        notes: "Patient reported not taken yet. Auto follow-up scheduled in 1 minute.",
        targetChatId: chatId,
      });

      // Schedule follow-up prompt in 60 seconds
      console.log(`[telegramCare] ⏳ Scheduling Telegram follow-up in 60 seconds for ${patientName}...`);
      setTimeout(async () => {
        await sendTelegramMedicationCheck({
          patientId,
          patientName,
          attemptNo: 2,
          chatId,
          isFollowup: true,
        });
      }, 60_000);

      return { ok: true, responseMessage: reply };
    } else {
      // ── ATTEMPT 2: ESCALATE TO CAREGIVER ──────────────────────────────────
      if (session) session.status = "escalated";

      try {
        await supabase
          .from("patients")
          .update({
            status: "no",
            recheck_pending: false,
            recheck_due_at: null,
          })
          .eq("id", patientId);

        await supabase.from("escalations").insert({
          patient_id: patientId,
          sms_sent_to: chatId,
          message: `Raksha Alert: ${patientName} confirmed for the second time that they have not taken their medicine today.`,
          reason: "missed_dose_reported",
        });
      } catch (e) {
        console.warn("[telegramCare] Escalation insert note:", e);
      }

      const reply = `🚨 <b>Raksha Care Alert:</b>\nYou have confirmed for the second time that your medicine was NOT taken.\n\nAn alert has been dispatched to your caregiver and family.`;
      await sendTelegram(chatId, reply);

      scheduleCaregiverAlert({
        patientId,
        reason: "missed_dose_reported",
        customMessage: `Raksha Alert: ${patientName} confirmed for the second time that they have not taken their medicine today. Please check in with them.`,
        delayMs: 0,
      });

      await notifyUrgent(
        `🚨 <b>RAKSHA EMERGENCY ESCALATION</b>\n\n` +
        `👤 <b>Patient:</b> ${patientName}\n` +
        `❌ <b>Status:</b> Confirmed NOT taken on 2 consecutive attempts.\n` +
        `🕒 <b>Time:</b> ${new Date().toLocaleTimeString("en-IN")}\n` +
        `⚠️ <b>Action Required:</b> Please check in with the patient immediately.`
      );

      return { ok: true, responseMessage: reply };
    }
  }

  // ── CASE 3: REMIND IN 1 MIN (SNOOZE) ──────────────────────────────────────
  if (opts.action === "remind") {
    const reply = `⏰ <b>Raksha:</b> Understood! We will send you another reminder in <b>1 minute</b>.`;
    await sendTelegram(chatId, reply);

    setTimeout(async () => {
      await sendTelegramMedicationCheck({
        patientId,
        patientName,
        attemptNo: attemptNo + 1,
        chatId,
        isFollowup: true,
      });
    }, 60_000);

    return { ok: true, responseMessage: reply };
  }

  return { ok: true, responseMessage: "Response processed." };
}
