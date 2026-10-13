// app/api/sms/reply/route.ts
// Inbound Twilio SMS webhook handling patient replies ("1" = Taken, "2" = Not Taken)

import { NextRequest, NextResponse } from "next/server";
import {
  getLatestMedicationCheckByPhone,
  upsertMedicationCheck,
} from "@/lib/medication-checks";
import { appendDoseEvent } from "@/lib/dose-events";
import { scheduleCaregiverAlert } from "@/lib/familyAlert";
import { notifyPatientMedicationResponse } from "@/lib/telegram";

export async function POST(req: NextRequest) {
  try {
    let bodyText = "";
    let fromPhone = "";

    try {
      const formData = await req.formData();
      bodyText = (formData.get("Body") as string) || "";
      fromPhone = (formData.get("From") as string) || "";
    } catch {
      const json = await req.json().catch(() => ({}));
      bodyText = json.Body || json.body || json.text || "";
      fromPhone = json.From || json.from || "";
    }

    if (!bodyText) {
      const { searchParams } = new URL(req.url);
      bodyText = searchParams.get("Body") || searchParams.get("text") || "";
      fromPhone = searchParams.get("From") || searchParams.get("from") || fromPhone;
    }

    const trimmed = bodyText.trim().toLowerCase();
    console.log(`[sms/reply] Incoming SMS from ${fromPhone}: "${trimmed}"`);

    // Find the latest medication check record for this phone
    const check = fromPhone ? getLatestMedicationCheckByPhone(fromPhone) : undefined;
    const targetCheckId = check?.id || "";
    const targetPatientId = check?.patientId || "";
    const patientName = check?.patientName || "Patient";
    const medicineName = check?.medicineName;

    let replyMessage = "";
    let action: "taken" | "not_taken" | "skipped" | "rescheduled" | "other" = "other";

    if (
      trimmed === "1" ||
      trimmed.startsWith("1") ||
      trimmed.includes("taken") ||
      trimmed.includes("yes") ||
      trimmed.includes("took") ||
      trimmed.includes("had it") ||
      trimmed.includes("done")
    ) {
      // ── PATIENT REPLIED 1: MEDICINE TAKEN ────────────────────────────────
      action = "taken";
      console.log(`[sms/reply] Patient confirmed medicine TAKEN (checkId: ${targetCheckId})`);

      const updated = upsertMedicationCheck(targetCheckId, targetPatientId, {
        status: "completed",
        response: "Taken",
        digits: "1",
        notes: `Patient confirmed via SMS: "${bodyText.trim()}" (Taken)`,
      });

      if (updated?.doseId) {
        appendDoseEvent({
          doseId: updated.doseId,
          patientId: updated.patientId,
          eventType: "taken",
          medicineName: updated.medicineName,
          source: "sms_reply_1",
        });
      }

      replyMessage = "✅ Raksha: Thank you! We have recorded that you took your medicine.";
    } else if (
      trimmed === "2" ||
      trimmed.startsWith("2") ||
      trimmed.includes("not taken") ||
      trimmed.includes("not yet") ||
      trimmed.includes("no") ||
      trimmed.includes("haven't") ||
      trimmed.includes("did not")
    ) {
      // ── PATIENT REPLIED 2: NOT TAKEN ─────────────────────────────────────
      action = "not_taken";
      console.log(`[sms/reply] Patient reported medicine NOT TAKEN (checkId: ${targetCheckId})`);

      upsertMedicationCheck(targetCheckId, targetPatientId, {
        status: "completed",
        response: "Not Taken",
        digits: "2",
        notes: `Patient reported via SMS: "${bodyText.trim()}" (Not Taken). Caregiver alerted.`,
      });

      if (targetPatientId) {
        scheduleCaregiverAlert({
          patientId: targetPatientId,
          reason: "missed_dose_reported",
          customMessage: `Raksha Alert: ${patientName} replied via SMS that they have not taken their medicine today. Please check in with them.`,
          delayMs: 30_000,
        });
      }

      replyMessage = "⚠️ Raksha: Thank you for letting us know. Please take your medicine as advised. Your caregiver has been alerted.";
    } else if (
      trimmed === "3" ||
      trimmed.startsWith("3") ||
      trimmed.includes("skip") ||
      trimmed.includes("skipped") ||
      trimmed.includes("skipping")
    ) {
      // ── PATIENT REPLIED 3: SKIP DOSE ─────────────────────────────────────
      action = "skipped";
      console.log(`[sms/reply] Patient reported dose SKIPPED (checkId: ${targetCheckId})`);

      const updated = upsertMedicationCheck(targetCheckId, targetPatientId, {
        status: "completed",
        response: "Skipped",
        digits: "3",
        notes: `Patient reported via SMS: "${bodyText.trim()}" (Skipped dose)`,
      });

      if (updated?.doseId) {
        appendDoseEvent({
          doseId: updated.doseId,
          patientId: updated.patientId,
          eventType: "skipped",
          medicineName: updated.medicineName,
          source: "sms_reply_skip",
        });
      }

      replyMessage = "⏭️ Raksha: Noted. We have recorded that you are skipping this dose. Stay well!";
    } else if (
      trimmed === "4" ||
      trimmed.startsWith("4") ||
      trimmed.includes("reschedule") ||
      trimmed.includes("snooze") ||
      trimmed.includes("later") ||
      trimmed.includes("remind")
    ) {
      // ── PATIENT REPLIED 4: RESCHEDULE / SNOOZE ────────────────────────────
      action = "rescheduled";
      console.log(`[sms/reply] Patient requested dose RESCHEDULE / SNOOZE (checkId: ${targetCheckId})`);

      const updated = upsertMedicationCheck(targetCheckId, targetPatientId, {
        status: "completed",
        response: "Rescheduled",
        digits: "4",
        notes: `Patient reported via SMS: "${bodyText.trim()}" (Rescheduled / Snoozed)`,
      });

      if (updated?.doseId) {
        appendDoseEvent({
          doseId: updated.doseId,
          patientId: updated.patientId,
          eventType: "rescheduled",
          medicineName: updated.medicineName,
          source: "sms_reply_reschedule",
        });
      }

      replyMessage = "⏰ Raksha: Understood. We have snoozed this reminder and will follow up with you later today.";
    } else {
      // ── PATIENT SENT ANY OTHER CUSTOM TEXT ────────────────────────────────
      action = "other";
      console.log(`[sms/reply] Patient sent custom response: "${bodyText}" (checkId: ${targetCheckId})`);

      upsertMedicationCheck(targetCheckId, targetPatientId, {
        status: "completed",
        response: bodyText.slice(0, 40),
        notes: `Patient custom SMS reply: "${bodyText.trim()}"`,
      });

      replyMessage = "Raksha: Thank you for your reply. We have forwarded your message to your care team.";
    }

    // ── SEND UPDATE TO TELEGRAM BOT ──────────────────────────────────────────
    await notifyPatientMedicationResponse({
      patientName,
      patientPhone: fromPhone,
      patientId: targetPatientId,
      action,
      medicineName,
      rawText: bodyText.trim(),
      channel: "sms",
      notes: `Received via Twilio inbound SMS`,
    });

    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>${replyMessage}</Message>
</Response>`;

    return new NextResponse(twiml, {
      status: 200,
      headers: { "Content-Type": "text/xml; charset=utf-8" },
    });
  } catch (err: any) {
    console.error("[sms/reply] Error processing incoming SMS:", err);
    return new NextResponse(
      `<?xml version="1.0" encoding="UTF-8"?><Response><Message>Raksha: Thank you for your reply.</Message></Response>`,
      { status: 200, headers: { "Content-Type": "text/xml; charset=utf-8" } }
    );
  }
}

export async function GET(req: NextRequest) {
  return POST(req);
}
