// app/api/twiml/medication-check/route.ts
// Generates TwiML to ask the patient if they took their medicine and gather keypad DTMF (1 or 2)

import { NextRequest, NextResponse } from "next/server";
import { updateMedicationCheckByCallSidOrId, getLatestMedicationCheck } from "@/lib/medication-checks";

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

function buildTwiML(checkId: string, patientId: string, baseUrl: string, isRetry: boolean, isFollowUp: boolean): string {
  // NOTE: In XML attributes, the '&' character MUST be escaped as '&amp;'
  // so the XML parser does not throw a 12100 entity parse error.
  const queryParams = `checkId=${encodeURIComponent(checkId)}&amp;patientId=${encodeURIComponent(patientId)}${isFollowUp ? "&amp;isFollowUp=1" : ""}`;
  const actionUrl = `${baseUrl}/api/twiml/handle-response?${queryParams}`;
  const timeoutUrl = `${baseUrl}/api/twiml/handle-response?${queryParams}&amp;noInput=1`;

  const promptText = isRetry
    ? "Sorry, that was not an option. Let us try once more. Have you taken your medicine today? If yes, press 1. If no, press 2."
    : isFollowUp
    ? "Hello, this is a follow-up check from your care team. Have you taken your medicine now? If yes, press 1. If no, press 2."
    : "Hello, this is a medication check from your care team. Have you taken your medicine today? If yes, press 1. If no, press 2.";

  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Pause length="1"/>
  <Gather input="dtmf" numDigits="1" timeout="8" action="${actionUrl}" method="POST">
    <Say voice="Polly.Aditi" language="en-IN">
      ${promptText}
    </Say>
  </Gather>
  <Say voice="Polly.Aditi" language="en-IN">
    We did not receive any input. Goodbye.
  </Say>
  <Redirect method="POST">${timeoutUrl}</Redirect>
</Response>`;
}

async function handleRequest(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const checkId = searchParams.get("checkId") || "";
  const patientId = searchParams.get("patientId") || "";
  const isRetry = searchParams.get("retry") === "1";
  const isFollowUp = searchParams.get("isFollowUp") === "1";

  console.log(`[twiml/medication-check] Incoming ${req.method} request:`, {
    checkId,
    patientId,
    isRetry,
    isFollowUp,
    url: req.url,
  });

  // If checkId or patientId is available, update status to in_progress
  if (checkId) {
    updateMedicationCheckByCallSidOrId(checkId, {
      status: "in_progress",
      notes: isRetry ? "Patient retrying after invalid key..." : "Patient answered call. Playing prompt...",
    });
  } else if (patientId) {
    const latest = getLatestMedicationCheck(patientId);
    if (latest && latest.response === "Pending") {
      updateMedicationCheckByCallSidOrId(latest.id, {
        status: "in_progress",
        notes: isRetry ? "Patient retrying after invalid key..." : "Patient answered call. Playing prompt...",
      });
    }
  }

  const baseUrl = getPublicBaseUrl();
  const xml = buildTwiML(checkId, patientId, baseUrl, isRetry, isFollowUp);

  console.log(`[twiml/medication-check] Generated TwiML:\n${xml}`);

  return new NextResponse(xml, {
    status: 200,
    headers: {
      "Content-Type": "text/xml; charset=utf-8",
      "Cache-Control": "no-cache, no-store, must-revalidate",
      "ngrok-skip-browser-warning": "true",
    },
  });
}

export async function GET(req: NextRequest) {
  return handleRequest(req);
}

export async function POST(req: NextRequest) {
  return handleRequest(req);
}
