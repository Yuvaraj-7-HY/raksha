// app/api/twilio/sms/route.ts
// Alias for /api/sms/reply for standard Twilio incoming SMS webhook

import { NextRequest } from "next/server";
import { POST as handleSmsPost, GET as handleSmsGet } from "@/app/api/sms/reply/route";

export async function POST(req: NextRequest) {
  return handleSmsPost(req);
}

export async function GET(req: NextRequest) {
  return handleSmsGet(req);
}
