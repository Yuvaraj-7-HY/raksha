// app/api/telegram/trigger/route.ts
// POST: Triggers an interactive Telegram medication check with inline options

import { NextRequest, NextResponse } from "next/server";
import { sendTelegramMedicationCheck } from "@/lib/telegramCare";
import { startTelegramPoller } from "@/lib/telegramPoller";
import { db } from "@/lib/supabaseServer";

export async function POST(req: NextRequest) {
  try {
    startTelegramPoller(); // Ensure Telegram poller is actively listening for replies

    const body = await req.json().catch(() => ({}));
    let patientId = body.patient_id;
    let patientName = body.patient_name;
    const chatId = body.chat_id;

    if (!patientId) {
      const supabase = db.get();
      const { data: p } = await supabase
        .from("patients")
        .select("id, name")
        .eq("is_active", true)
        .limit(1)
        .single();
      patientId = p?.id || "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
      patientName = p?.name || patientName;
    }

    const result = await sendTelegramMedicationCheck({
      patientId,
      patientName,
      chatId,
      attemptNo: 1,
    });

    return NextResponse.json({
      ok: true,
      message: "Interactive Telegram medication check sent successfully!",
      check_id: result.checkId,
      patient_id: patientId,
      instructions: "Check your Telegram bot. Click 'Yes' or 'No', or wait 1 min without replying to test auto follow-up.",
    });
  } catch (err: any) {
    console.error("[telegram/trigger] Error:", err);
    return NextResponse.json({ ok: false, error: err?.message }, { status: 500 });
  }
}

export async function GET() {
  // Convenient GET trigger for quick browser testing
  startTelegramPoller();
  const result = await sendTelegramMedicationCheck({
    patientId: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    patientName: "Ramesh Iyer",
    attemptNo: 1,
  });

  return NextResponse.json({
    ok: true,
    message: "Interactive Telegram medication check dispatched!",
    check_id: result.checkId,
    help: "Check your Telegram app. Click an option or reply 1/2. If you say No or don't reply, a follow-up will arrive in 1 min.",
  });
}
