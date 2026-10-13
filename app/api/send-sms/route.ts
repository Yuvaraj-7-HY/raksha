// app/api/send-sms/route.ts
// Sends an SMS to a patient's caregiver using Twilio

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
      console.error("[send-sms] Missing Twilio credentials:", {
        hasSid: !!accountSid,
        hasAuth: !!authToken,
        hasFrom: !!fromNumber,
      });
      return NextResponse.json(
        {
          success: false,
          error:
            "Twilio credentials (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER) are not fully configured in environment.",
        },
        { status: 500 }
      );
    }

    // Default message fallback
    if (!messageText || !messageText.trim()) {
      const name = patientName ? patientName.trim() : "your patient";
      messageText = `Hello, this is a check-in from the care team regarding ${name}. Please check on them and their medication. Thank you.`;
    }

    // Phone number sanitization
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

    // Normalize phone number (remove extra spaces and dashes)
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

    // Initialize Twilio client
    const client = twilio(accountSid, authToken);

    console.log(`[send-sms] Sending SMS to ${normalizedTo} from ${fromNumber}...`);

    const result = await client.messages.create({
      body: messageText,
      from: fromNumber,
      to: normalizedTo,
    });

    console.log(`[send-sms] SMS sent successfully. SID: ${result.sid}`);

    return NextResponse.json({
      success: true,
      sid: result.sid,
      to: normalizedTo,
      recipientName: caregiverName || "Caregiver",
      patientId: patientId || null,
      message: messageText,
      status: result.status,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error("[send-sms] Error sending SMS:", err);
    const twilioMessage =
      err?.message || "Failed to send SMS via Twilio. Check phone number format and credentials.";
    return NextResponse.json(
      {
        success: false,
        error: twilioMessage,
        code: err?.code,
      },
      { status: 500 }
    );
  }
}
