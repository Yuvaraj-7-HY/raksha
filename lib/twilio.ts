// lib/twilio.ts
// Twilio client singleton — server-side only

import twilio from "twilio";
import { PUBLIC_BASE_URL } from "./config";

const accountSid = process.env.TWILIO_ACCOUNT_SID!;
const authToken = process.env.TWILIO_AUTH_TOKEN!;
const fromNumber = process.env.TWILIO_FROM_NUMBER!;

export const twilioClient = twilio(accountSid, authToken, {
  lazyLoading: true,
});

export const TWILIO_FROM_NUMBER = fromNumber;

export async function makeOutboundCall(params: {
  to: string;
  callId: string;
  callType: string;
  context: string;
  attempt: number;
}): Promise<string> {
  const baseUrl = PUBLIC_BASE_URL || process.env.PUBLIC_BASE_URL || "";
  const call = await twilioClient.calls.create({
    to: params.to,
    from: fromNumber,
    url: `${baseUrl}/api/twilio/voice?callId=${params.callId}`,
    method: "POST",
    statusCallback: `${baseUrl}/api/twilio/status?callId=${params.callId}`,
    statusCallbackEvent: ["initiated", "ringing", "answered", "completed"],
    statusCallbackMethod: "POST",
    timeout: 30,
  });
  return call.sid;
}

export function validateTwilioSignature(
  authToken: string,
  signature: string | null,
  url: string,
  params: Record<string, string>
): boolean {
  if (!signature) return false;
  try {
    return twilio.validateRequest(authToken, signature, url, params);
  } catch {
    return false;
  }
}