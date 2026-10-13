// app/api/call-patient/route.ts
// Initiates an outbound interactive medication check call to a patient using Twilio

import { NextRequest, NextResponse } from "next/server";
import twilio from "twilio";
import { saveMedicationCheck } from "@/lib/medication-checks";
import { sendTelegram } from "@/lib/telegram";

function normalizePhone(input: string): string {
  let cleaned = input.trim().replace(/[\s\-()]/g, "");
  // If 10 digits without +, default to India (+91)
  if (/^\d{10}$/.test(cleaned)) {
    cleaned = `+91${cleaned}`;
  }
  // If starts with 91 followed by 10 digits without +, prepend +
  if (/^91\d{10}$/.test(cleaned)) {
    cleaned = `+${cleaned}`;
  }
  if (!cleaned.startsWith("+")) {
    cleaned = `+${cleaned}`;
  }
  return cleaned;
}

function getPublicBaseUrl(): string {
  const envUrl =
    process.env.TWILIO_WEBHOOK_BASE_URL ||
    process.env.NEXT_PUBLIC_BASE_URL ||
    process.env.PUBLIC_BASE_URL ||
    "https://uncoiled-dominion-dad.ngrok-free.dev";

  let url = envUrl.trim();
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    url = `https://${url}`;
  }
  return url.replace(/\/$/, "");
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { patientId = "patient-1", patientName = "Grandma Kamala" } = body;
    let targetPhone = body.phone || body.patientPhone;
    // Optional — links this call to a specific scheduled dose
    const doseId: string | undefined = body.doseId || undefined;
    const medicineName: string | undefined = body.medicineName || undefined;
    const isDeaf: boolean = Boolean(body.isDeaf);

    // Fallback to configured patient phone in env if not provided
    if (!targetPhone) {
      targetPhone = process.env.PATIENT_PHONE_NUMBER || "+917406842246";
    }

    const normalizedPhone = normalizePhone(targetPhone);

    const baseUrl = getPublicBaseUrl();
    const checkId = `mc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const nowIso = new Date().toISOString();

    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const fromNumber = process.env.TWILIO_PHONE_NUMBER || process.env.TWILIO_FROM_NUMBER;

    // ──────────────────────────────────────────────────────────────────────────
    // 🧏 DEAF ACCESSIBILITY FLOW: Send direct SMS & Telegram message
    // ──────────────────────────────────────────────────────────────────────────
    if (isDeaf) {
      const smsMessage = `🔔 Raksha Medication Reminder for ${patientName}:
Have you taken your medicine${medicineName ? ` (${medicineName})` : ""} today?

Reply:
1 - if medicine is taken
2 - if not taken
3 - to skip this dose
4 - to reschedule / remind later`;

      let smsSid: string | undefined;
      let smsSuccess = false;

      // 1. Send SMS via Twilio
      if (accountSid && authToken) {
        try {
          const client = twilio(accountSid, authToken);
          const msgParams: any = {
            to: normalizedPhone,
            body: smsMessage,
          };
          if (process.env.TWILIO_MESSAGING_SERVICE_SID) {
            msgParams.messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID;
          } else if (fromNumber) {
            msgParams.from = fromNumber;
          }
          const sms = await client.messages.create(msgParams);
          smsSid = sms.sid;
          smsSuccess = true;
          console.log(`[call-patient] Deaf mode: SMS sent to ${normalizedPhone}, sid: ${sms.sid}`);
        } catch (smsErr: any) {
          console.warn(`[call-patient] Deaf mode: SMS send failed:`, smsErr?.message);
        }
      }

      // 2. Send Telegram message with interactive inline buttons
      const telegramTarget = body.telegramChatId || process.env.PATIENT_TELEGRAM_CHAT_ID || process.env.FAMILY_CHAT_ID;
      let telegramSuccess = false;
      if (telegramTarget) {
        const tgText = `🔔 <b>Raksha Medication Reminder for ${patientName}</b>\n\nHave you taken your medicine${medicineName ? ` (<b>${medicineName}</b>)` : ""} today?\n\n<b>Reply with:</b>\n<b>1</b> - Medicine is taken\n<b>2</b> - Not taken\n<b>3</b> - Skip dose\n<b>4</b> - Reschedule / remind later`;
        const replyMarkup = {
          inline_keyboard: [
            [
              { text: "1 - Taken ✅", callback_data: `taken:${checkId}:${patientId}` },
              { text: "2 - Not Taken ❌", callback_data: `not_taken:${checkId}:${patientId}` },
            ],
            [
              { text: "3 - Skip ⏭️", callback_data: `skip:${checkId}:${patientId}` },
              { text: "4 - Reschedule ⏰", callback_data: `reschedule:${checkId}:${patientId}` },
            ],
          ],
        };
        telegramSuccess = await sendTelegram(telegramTarget, tgText, replyMarkup);
        console.log(`[call-patient] Deaf mode: Telegram sent to ${telegramTarget}: ${telegramSuccess}`);
      }

      // 3. Save medication check record with Pending response
      const initialRecord = saveMedicationCheck({
        id: checkId,
        patientId: String(patientId),
        patientName: String(patientName),
        phone: normalizedPhone,
        doseId,
        medicineName,
        status: "calling",
        response: "Pending",
        channel: "sms",
        isDeaf: true,
        notes: `Deaf mode: Interactive reminder sent (SMS: ${smsSuccess ? "Sent" : "Simulated"}, Telegram: ${telegramSuccess ? "Sent" : "Simulated"}). Waiting for reply 1 or 2...`,
        timestamp: nowIso,
        createdAt: nowIso,
        updatedAt: nowIso,
      });

      return NextResponse.json({
        success: true,
        isDeaf: true,
        message: `Medication check message sent to ${patientName} via SMS & Telegram (Deaf accessibility mode).`,
        checkId,
        record: initialRecord,
        smsSid,
        smsSent: smsSuccess,
        telegramSent: telegramSuccess,
      });
    }

    // ──────────────────────────────────────────────────────────────────────────
    // 📞 STANDARD FLOW: Outbound voice call for hearing patients
    // ──────────────────────────────────────────────────────────────────────────
    if (!accountSid || !authToken || !fromNumber) {
      return NextResponse.json(
        {
          success: false,
          error: "Twilio credentials (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER) are missing in environment.",
        },
        { status: 500 }
      );
    }

    // Create record in store with initial "Pending" response
    const initialRecord = saveMedicationCheck({
      id: checkId,
      patientId: String(patientId),
      patientName: String(patientName),
      phone: normalizedPhone,
      doseId,
      medicineName,
      status: "calling",
      response: "Pending",
      channel: "voice_call",
      isDeaf: false,
      notes: "Call initiated. Waiting for patient to answer...",
      timestamp: nowIso,
      createdAt: nowIso,
      updatedAt: nowIso,
    });

    const client = twilio(accountSid, authToken);

    // Full public HTTPS URLs for Twilio
    const twimlUrl = `${baseUrl}/api/twiml/medication-check?checkId=${encodeURIComponent(checkId)}&patientId=${encodeURIComponent(patientId)}`;
    const statusUrl = `${baseUrl}/api/twiml/call-status?checkId=${encodeURIComponent(checkId)}&patientId=${encodeURIComponent(patientId)}`;

    console.log(`[call-patient] Placing Twilio call to ${normalizedPhone}:`);
    console.log(`[call-patient] TwiML URL: ${twimlUrl}`);
    console.log(`[call-patient] Status Callback: ${statusUrl}`);

    const call = await client.calls.create({
      to: normalizedPhone,
      from: fromNumber,
      url: twimlUrl,
      statusCallback: statusUrl,
      statusCallbackEvent: ["initiated", "ringing", "answered", "completed"],
      timeout: Number(process.env.RING_TIMEOUT_SECONDS) || 30,
    });

    // Save with CallSid
    initialRecord.callSid = call.sid;
    saveMedicationCheck(initialRecord);

    console.log(`[call-patient] Call created successfully. CallSid: ${call.sid}`);

    return NextResponse.json({
      success: true,
      message: `Calling ${patientName} at ${normalizedPhone} for medication check.`,
      checkId: checkId,
      callSid: call.sid,
      record: initialRecord,
    });
  } catch (err: any) {
    console.error("[call-patient] Error initiating call:", err);
    return NextResponse.json(
      {
        success: false,
        error: err.message || "Failed to initiate medication check call.",
      },
      { status: 500 }
    );
  }
}
