// app/api/call-patient/reply/route.ts
// Direct API endpoint to simulate or record patient reply (1 = Taken, 2 = Not Taken)

import { NextRequest, NextResponse } from "next/server";
import {
  getLatestMedicationCheck,
  upsertMedicationCheck,
} from "@/lib/medication-checks";
import { appendDoseEvent } from "@/lib/dose-events";
import { scheduleCaregiverAlert } from "@/lib/familyAlert";
import { notifyPatientMedicationResponse } from "@/lib/telegram";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { patientId = "", checkId = "", reply = "1", source = "manual_simulation" } = body;

    const trimmed = String(reply).trim();
    const lower = trimmed.toLowerCase();

    const isTaken =
      lower === "1" ||
      lower.startsWith("1") ||
      lower.includes("taken") ||
      lower.includes("yes") ||
      lower.includes("took") ||
      lower.includes("done");

    const isNotTaken =
      lower === "2" ||
      lower.startsWith("2") ||
      lower.includes("not taken") ||
      lower.includes("not yet") ||
      lower.includes("no") ||
      lower.includes("haven't") ||
      lower.includes("did not");

    const isSkip =
      lower === "3" ||
      lower.startsWith("3") ||
      lower.includes("skip") ||
      lower.includes("skipped");

    const isReschedule =
      lower === "4" ||
      lower.startsWith("4") ||
      lower.includes("reschedule") ||
      lower.includes("snooze") ||
      lower.includes("later") ||
      lower.includes("remind") ||
      lower.includes("hour") ||
      lower.includes("delay");

    let targetId = checkId;
    let existingCheck = null;
    if (!targetId && patientId) {
      existingCheck = getLatestMedicationCheck(patientId);
      if (existingCheck) targetId = existingCheck.id;
    } else if (targetId) {
      existingCheck = getLatestMedicationCheck(patientId);
    }

    const patientName = existingCheck?.patientName || "Patient";
    const patientPhone = existingCheck?.phone;
    const medicineName = existingCheck?.medicineName;

    if (isTaken) {
      const updated = upsertMedicationCheck(targetId, patientId, {
        status: "completed",
        response: "Taken",
        digits: "1",
        notes: `Patient confirmed response via ${source}: Key 1 (Taken)`,
      });

      if (updated?.doseId) {
        appendDoseEvent({
          doseId: updated.doseId,
          patientId: updated.patientId,
          eventType: "taken",
          medicineName: updated.medicineName,
          source: `simulated_reply_1`,
        });
      }

      await notifyPatientMedicationResponse({
        patientName: updated?.patientName || patientName,
        patientPhone,
        patientId,
        action: "taken",
        medicineName,
        rawText: trimmed,
        channel: source.includes("sms") ? "sms" : source.includes("voice") ? "voice_call" : "simulator",
        notes: `Recorded via ${source}`,
      });

      return NextResponse.json({
        success: true,
        response: "Taken",
        action: "taken",
        message: "Recorded response: Medicine Taken (Key 1)",
        record: updated,
      });
    } else if (isNotTaken) {
      const updated = upsertMedicationCheck(targetId, patientId, {
        status: "completed",
        response: "Not Taken",
        digits: "2",
        notes: `Patient indicated response via ${source}: Key 2 (Not Taken). Caregiver alert scheduled.`,
      });

      if (patientId) {
        scheduleCaregiverAlert({
          patientId,
          reason: "missed_dose_reported",
          customMessage: `Raksha Alert: ${updated?.patientName || patientName} confirmed they have not taken their medicine today. Please check on them.`,
          delayMs: 30_000,
        });
      }

      await notifyPatientMedicationResponse({
        patientName: updated?.patientName || patientName,
        patientPhone,
        patientId,
        action: "not_taken",
        medicineName,
        rawText: trimmed,
        channel: source.includes("sms") ? "sms" : source.includes("voice") ? "voice_call" : "simulator",
        notes: `Caregiver alert scheduled`,
      });

      return NextResponse.json({
        success: true,
        response: "Not Taken",
        action: "not_taken",
        message: "Recorded response: Medicine Not Taken (Key 2). Caregiver alert scheduled.",
        record: updated,
      });
    } else if (isSkip) {
      const updated = upsertMedicationCheck(targetId, patientId, {
        status: "completed",
        response: "Skipped",
        digits: "3",
        notes: `Patient indicated response via ${source}: Key 3 (Skipped dose)`,
      });

      if (updated?.doseId) {
        appendDoseEvent({
          doseId: updated.doseId,
          patientId: updated.patientId,
          eventType: "skipped",
          medicineName: updated.medicineName,
          source: `reply_skip`,
        });
      }

      await notifyPatientMedicationResponse({
        patientName: updated?.patientName || patientName,
        patientPhone,
        patientId,
        action: "skipped",
        medicineName,
        rawText: trimmed,
        channel: source.includes("sms") ? "sms" : source.includes("voice") ? "voice_call" : "simulator",
        notes: `Patient chose to skip dose`,
      });

      return NextResponse.json({
        success: true,
        response: "Skipped",
        action: "skipped",
        message: "Recorded response: Medicine Skipped (Key 3)",
        record: updated,
      });
    } else if (isReschedule) {
      const updated = upsertMedicationCheck(targetId, patientId, {
        status: "completed",
        response: "Rescheduled",
        digits: "4",
        notes: `Patient indicated response via ${source}: Key 4 (Rescheduled / Snoozed)`,
      });

      if (updated?.doseId) {
        appendDoseEvent({
          doseId: updated.doseId,
          patientId: updated.patientId,
          eventType: "rescheduled",
          medicineName: updated.medicineName,
          source: `reply_reschedule`,
        });
      }

      await notifyPatientMedicationResponse({
        patientName: updated?.patientName || patientName,
        patientPhone,
        patientId,
        action: "rescheduled",
        medicineName,
        rawText: trimmed,
        channel: source.includes("sms") ? "sms" : source.includes("voice") ? "voice_call" : "simulator",
        notes: `Reminder postponed`,
      });

      return NextResponse.json({
        success: true,
        response: "Rescheduled",
        action: "rescheduled",
        message: "Recorded response: Medicine Rescheduled / Snoozed (Key 4)",
        record: updated,
      });
    } else {
      // Custom text response
      const updated = upsertMedicationCheck(targetId, patientId, {
        status: "completed",
        response: trimmed.slice(0, 40),
        notes: `Patient response via ${source}: "${trimmed}"`,
      });

      await notifyPatientMedicationResponse({
        patientName: updated?.patientName || patientName,
        patientPhone,
        patientId,
        action: "other",
        medicineName,
        rawText: trimmed,
        channel: source.includes("sms") ? "sms" : source.includes("voice") ? "voice_call" : "simulator",
        notes: `Custom response received`,
      });

      return NextResponse.json({
        success: true,
        response: trimmed,
        action: "other",
        message: `Recorded custom response: "${trimmed}"`,
        record: updated,
      });
    }
  } catch (err: any) {
    console.error("[call-patient/reply] Error processing reply:", err);
    return NextResponse.json({
      success: false,
      error: err?.message || "Failed to process reply.",
    }, { status: 500 });
  }
}
