// app/api/telegram/webhook/route.ts
// Receives Telegram bot webhook updates (text messages "1"/"2" or inline keyboard callbacks)

import { NextRequest, NextResponse } from "next/server";
import { processTelegramUpdate } from "@/lib/telegramPoller";

export async function POST(req: NextRequest) {
  try {
    const update = await req.json().catch(() => ({}));
    if (update && update.update_id) {
      await processTelegramUpdate(update);
    }
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("[telegram/webhook] Error handling update:", err);
    return NextResponse.json({ ok: false, error: err?.message }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ ok: true, status: "Telegram webhook active" });
}
