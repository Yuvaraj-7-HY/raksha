// lib/twilio.ts
// Twilio client singleton — server-side only

import twilio from "twilio";

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const fromNumber = process.env.TWILIO_FROM_NUMBER;

if (!accountSid || !authToken || !fromNumber) {
  throw new Error("Missing Twilio credentials: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER");
}

export const twilioClient = twilio(accountSid, authToken, {
  lazyLoading: true,
});

export const TWILIO_FROM_NUMBER = fromNumber;

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