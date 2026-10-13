// lib/familyAlert.ts
// Sends a family notification for a missed-dose event.
//
// Strategy:
//   1. Try Twilio Messaging Service SMS first.
//   2. If SMS throws (e.g. trial-account block on Indian numbers), fall back to Telegram.
//   3. Insert one escalation row with the reason and whichever channel actually worked.
//   4. If the daily-unique DB index rejects the insert, log "already sent" and return.
//
// NEVER throws — every branch is caught so the IVR webhook can still return TwiML.

import twilio from "twilio";
import { sendTelegram } from "./telegram";
import { db } from "./supabaseServer";

export type AlertReason = "unreachable" | "missed_dose_reported";

export interface FamilyAlertResult {
  sent:    boolean;
  channel: "sms" | "telegram" | "none";
  sid?:    string; // Twilio message SID or Telegram update_id (stringified)
  skipped: boolean; // true if the daily-unique index said "already sent"
}

/**
 * Send a missed-dose (or unreachable) alert to the family and record
 * an escalation row in Supabase.
 *
 * @param patientId  UUID of the patient row
 * @param patientName Display name for the SMS/Telegram text
 * @param familyPhone E.164 number to SMS (may be undefined if not set)
 * @param reason      'missed_dose_reported' | 'unreachable'
 */
export async function sendFamilyAlert(opts: {
  patientId:     string;
  patientName:   string;
  familyPhone:   string | null;
  reason:        AlertReason;
  customMessage?: string;
}): Promise<FamilyAlertResult> {
  const { patientId, patientName, familyPhone, reason, customMessage } = opts;

  // Compose message — deliberately contains NO dose, amount, or medical advice.
  const message =
    customMessage ||
    (reason === "missed_dose_reported"
      ? `Raksha: ${patientName} told us they have not taken their medicine today. Please check in when you can.`
      : `Raksha: We were unable to reach ${patientName} for their medication check today. Please check on them.`);

  console.log(`[familyAlert] Sending alert. patient=${patientId} reason=${reason} to=${familyPhone}`);

  let channel: "sms" | "telegram" | "none" = "none";
  let sid: string | undefined;

  // ── 1. Try SMS via Twilio ──────────────────────────────────────────────────
  if (familyPhone) {
    try {
      const twilioClient = twilio(
        process.env.TWILIO_ACCOUNT_SID!,
        process.env.TWILIO_AUTH_TOKEN!
      );

      const msgParams: any = {
        to:   familyPhone,
        body: message,
      };

      if (process.env.TWILIO_MESSAGING_SERVICE_SID) {
        msgParams.messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID;
      } else {
        msgParams.from = process.env.TWILIO_PHONE_NUMBER || process.env.TWILIO_FROM_NUMBER;
      }

      const msg = await twilioClient.messages.create(msgParams);
      channel = "sms";
      sid     = msg.sid;
      console.log(`[familyAlert] SMS sent to assigned caregiver ${familyPhone}. sid=${msg.sid}`);
    } catch (smsErr) {
      console.warn("[familyAlert] SMS failed — falling back to Telegram:", smsErr);
    }
  } else {
    console.warn("[familyAlert] No family_phone on patient — skipping SMS, trying Telegram");
  }

  // ── 2. Telegram fallback ────────────────────────────────────────────────────
  if (channel === "none") {
    const chatId = process.env.FAMILY_CHAT_ID ?? "";
    if (chatId) {
      const ok = await sendTelegram(chatId, message);
      if (ok) {
        channel = "telegram";
        console.log("[familyAlert] Telegram fallback succeeded.");
      } else {
        console.error("[familyAlert] Both SMS and Telegram failed.");
      }
    } else {
      console.warn("[familyAlert] FAMILY_CHAT_ID not set — no Telegram fallback.");
    }
  }

  // ── 3. Insert escalation row (unique index guards daily dedup) ──────────────
  const { error: dbErr } = await db.get()
    .from("escalations")
    .insert({
      patient_id:   patientId,
      sms_sent_to:  familyPhone ?? "telegram",
      message,
      reason,
      twilio_sid:   sid ?? null,
    });

  if (dbErr) {
    // Postgres error code 23505 = unique_violation
    if ((dbErr as { code?: string }).code === "23505") {
      console.log(`[familyAlert] Daily duplicate blocked by DB — already sent today. reason=${reason}`);
      return { sent: false, channel: "none", skipped: true };
    }
    // Any other DB error: log but don't throw (IVR must still return TwiML)
    console.error("[familyAlert] DB insert error:", dbErr);
  }

  return { sent: channel !== "none", channel, sid, skipped: false };
}

/**
 * Schedules a message to be sent to the assigned caregiver after a delay (default 1 min = 60,000 ms).
 * Handles looking up the assigned caregiver phone number from Supabase or storage.
 */
export function scheduleCaregiverAlert(opts: {
  patientId:      string;
  patientName?:   string;
  familyPhone?:   string | null;
  reason:         AlertReason;
  customMessage?: string;
  delayMs?:       number; // default: 60,000 (1 minute)
}) {
  const delay = opts.delayMs ?? 60_000;
  console.log(`[familyAlert] Caregiver alert scheduled in ${delay / 1000}s for patient=${opts.patientId} reason=${opts.reason}`);

  setTimeout(async () => {
    try {
      console.log(`[familyAlert] 1 minute elapsed. Delivering caregiver alert for patient=${opts.patientId} reason=${opts.reason}...`);

      let patientName = opts.patientName;
      let familyPhone = opts.familyPhone;

      // 1. Look up from Supabase
      if (!patientName || !familyPhone) {
        try {
          const { findPatientById } = await import("./supabaseServer");
          const p = await findPatientById(opts.patientId);
          if (p) {
            patientName = patientName || p.name;
            familyPhone = familyPhone || p.family_phone;
          }
        } catch (e) {
          console.warn("[familyAlert] Could not fetch patient from Supabase:", e);
        }
      }

      // 2. Look up from local storage
      if (!patientName || !familyPhone) {
        try {
          const { getPatientById, getPrimaryCaregiver } = await import("./storage");
          const p = getPatientById(opts.patientId);
          if (p) {
            patientName = patientName || p.name;
            const primary = getPrimaryCaregiver(p);
            familyPhone = familyPhone || primary?.phone || null;
          }
        } catch (e) {
          console.warn("[familyAlert] Could not fetch patient from storage:", e);
        }
      }

      // 3. Environment fallback for assigned caregiver
      if (!familyPhone) {
        familyPhone =
          process.env.CAREGIVER_PHONE_NUMBER ||
          process.env.FAMILY_PHONE_NUMBER ||
          process.env.DEFAULT_TO_NUMBER ||
          "+918073909604";
      }

      await sendFamilyAlert({
        patientId:     opts.patientId,
        patientName:   patientName || "Patient",
        familyPhone:   familyPhone ?? null,
        reason:        opts.reason,
        customMessage: opts.customMessage,
      });
    } catch (err) {
      console.error("[familyAlert] Error delivering scheduled caregiver alert:", err);
    }
  }, delay);
}

