// app/api/make-call/route.ts
// Initiates an outbound voice call to a patient's caregiver using Twilio

import { NextRequest, NextResponse } from "next/server";
import twilio from "twilio";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { patientId, patientName, caregiverName } = body;
    let to: string | undefined =
      body.to ||
      body.caregiverPhone ||
      process.env.CAREGIVER_PHONE_NUMBER ||
      process.env.DEFAULT_TO_NUMBER ||
      "+918073909604";
    let messageText: string | undefined = body.message;

    // Credentials lookup from environment variables
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const fromNumber =
      process.env.TWILIO_PHONE_NUMBER || process.env.TWILIO_FROM_NUMBER;

    if (!accountSid || !authToken || !fromNumber) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Twilio credentials (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER) are not fully configured in environment.",
        },
        { status: 500 }
      );
    }

    to = to?.trim();
    if (!to) {
      return NextResponse.json(
        {
          success: false,
          error: "Recipient phone number is missing.",
        },
        { status: 400 }
      );
    }

    let normalizedTo = to.replace(/[\s\-()]/g, "");
    if (/^\d{10}$/.test(normalizedTo)) {
      normalizedTo = `+91${normalizedTo}`;
    } else if (/^91\d{10}$/.test(normalizedTo)) {
      normalizedTo = `+${normalizedTo}`;
    } else if (!normalizedTo.startsWith("+")) {
      normalizedTo = `+${normalizedTo}`;
    }
    if (normalizedTo.length < 8) {
      return NextResponse.json(
        {
          success: false,
          error: `Invalid recipient phone number format: "${to}".`,
        },
        { status: 400 }
      );
    }

    const name = patientName ? patientName.trim() : "your patient";
    const speechMessage =
      messageText ||
      `Hello ${caregiverName || "Caregiver"}. This is an automated update from Raksha Health regarding ${name}. Please check the Raksha Care portal to review today's medication routine and vitals. Thank you.`;

    const twimlResponse = `<Response><Pause length="1"/><Say voice="Polly.Aditi" language="en-IN">${speechMessage}</Say><Pause length="1"/><Say voice="Polly.Aditi" language="en-IN">Goodbye.</Say></Response>`;

    const client = twilio(accountSid, authToken);

    console.log(`[make-call] Placing outbound call to ${normalizedTo} from ${fromNumber}...`);

    const call = await client.calls.create({
      twiml: twimlResponse,
      to: normalizedTo,
      from: fromNumber,
    });

    console.log(`[make-call] Call placed successfully. SID: ${call.sid}`);

    return NextResponse.json({
      success: true,
      sid: call.sid,
      to: normalizedTo,
      recipientName: caregiverName || "Caregiver",
      patientId: patientId || null,
      status: call.status,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error("[make-call] Error placing call:", err);
    return NextResponse.json(
      {
        success: false,
        error:
          err?.message || "Failed to initiate call via Twilio. Check phone number format and credentials.",
        code: err?.code,
      },
      { status: 500 }
    );
  }
}
