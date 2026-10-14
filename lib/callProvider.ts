// lib/callProvider.ts
// Abstraction for placing outbound calls.
// Supports both Twilio (production) and Mock (simulated demo mode when Twilio credits expire).

import twilio from "twilio";
import { db } from "./supabaseServer";
import { tryStartRing } from "./ringState";

export interface CallProvider {
  placeCall(to: string, attemptId: string, options?: { patientId?: string; isRecheck?: boolean; attemptNo?: number }): Promise<{ sid?: string; status?: string }>;
}

/**
 * Twilio provider: Places a real outbound voice call via Twilio REST API.
 * Contains the existing calls.create logic unchanged.
 */
export const twilioProvider: CallProvider = {
  async placeCall(to: string, attemptId: string, options = {}) {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken  = process.env.TWILIO_AUTH_TOKEN;
    const fromNumber = process.env.TWILIO_PHONE_NUMBER || process.env.TWILIO_FROM_NUMBER;
    const baseUrl    = (process.env.TWILIO_WEBHOOK_BASE_URL ?? process.env.PUBLIC_BASE_URL ?? "").replace(/\/$/, "");

    if (!accountSid || !authToken || !fromNumber || !baseUrl) {
      throw new Error("[twilioProvider] Missing Twilio credentials or base URL in environment.");
    }

    const client = twilio(accountSid, authToken);
    const voiceUrl = new URL(`${baseUrl}/api/voice/simple`);
    if (options.patientId) voiceUrl.searchParams.set("patientId", options.patientId);
    if (options.isRecheck) voiceUrl.searchParams.set("is_recheck", "1");
    voiceUrl.searchParams.set("callSid", attemptId);

    const statusUrl = new URL(`${baseUrl}/api/voice/status`);
    if (options.patientId) statusUrl.searchParams.set("patientId", options.patientId);
    if (options.isRecheck) statusUrl.searchParams.set("is_recheck", "1");

    const call = await client.calls.create({
      to,
      from: fromNumber,
      url: voiceUrl.toString(),
      statusCallback: statusUrl.toString(),
      statusCallbackMethod: "POST",
      statusCallbackEvent: ["completed", "busy", "no-answer", "failed"],
      timeout: Number(process.env.RING_TIMEOUT_SECONDS ?? 30),
    });

    console.log(`[twilioProvider] Outbound call placed! SID: ${call.sid}`);
    return { sid: call.sid, status: call.status };
  },
};

/**
 * Mock provider: Simulated call mode for demos.
 * Updates the call attempt and ring state to "ringing". No network call is made to Twilio.
 */
export const mockProvider: CallProvider = {
  async placeCall(to: string, attemptId: string, options = {}) {
    const attemptNo = options.attemptNo ?? (options.isRecheck ? 2 : 1);
    console.log(`[mockProvider] Simulating outbound call to ${to} (attemptId: ${attemptId}, attemptNo: ${attemptNo})...`);

    // 1. Update in-memory & broadcast ring state so /demo-call and /api/demo-state pick it up
    tryStartRing({
      callId: attemptId,
      callType: "medication_check",
      context: options.isRecheck ? "recheck_call" : "initial_call",
      attempt: attemptNo,
    });

    // 2. Try updating call_attempts status in Supabase if the status column exists
    try {
      const supabase = db.get();
      await supabase
        .from("call_attempts")
        .update({
          status: "ringing",
          twilio_call_sid: `mock_${attemptId}`,
        })
        .eq("id", attemptId);
    } catch (e) {
      console.warn("[mockProvider] Note on call_attempts status update:", e);
    }

    return { sid: `mock_${attemptId}`, status: "ringing" };
  },
};

/**
 * Telegram provider: Switches interaction completely to Telegram!
 * Sends interactive medication check prompt with inline buttons directly to Telegram,
 * starts 1-min unanswered timeout, and handles follow-ups.
 */
export const telegramProvider: CallProvider = {
  async placeCall(to: string, attemptId: string, options = {}) {
    const { sendTelegramMedicationCheck } = await import("./telegramCare");
    const { startTelegramPoller } = await import("./telegramPoller");
    startTelegramPoller(); // ensure real-time poller is active

    const attemptNo = options.attemptNo ?? (options.isRecheck ? 2 : 1);
    const patientId = options.patientId || to;

    console.log(`[telegramProvider] Placing medication check via Telegram to patient=${patientId} (attempt: ${attemptNo})...`);

    const res = await sendTelegramMedicationCheck({
      patientId,
      attemptNo,
      attemptId,
      isFollowup: Boolean(options.isRecheck),
    });

    return { sid: `tg_${res.checkId}`, status: "sent" };
  },
};

export const provider: CallProvider =
  process.env.CALL_PROVIDER === "telegram"
    ? telegramProvider
    : process.env.CALL_PROVIDER === "mock"
    ? mockProvider
    : twilioProvider;

