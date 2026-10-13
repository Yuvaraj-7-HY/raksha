// app/api/turn/route.ts
// Runs the conversation brain directly — no longer proxies to n8n.
// Returns {reply, end_call, emergency} to the phone page.

export const runtime = "nodejs"; // required for better-sqlite3

import { runTurn, type HistoryItem } from "@/lib/brain/turn";

type TurnBody = {
  callId?: string;
  callType?: string;
  context?: string;
  history?: HistoryItem[];
  userText?: string | null;
  turnIndex?: number;
};

export async function POST(req: Request) {
  let body: TurnBody;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }

  const input = {
    callId: (body.callId ?? "local").trim(),
    callType: body.callType ?? "morning",
    context: body.context ?? "",
    history: Array.isArray(body.history) ? body.history : [],
    userText: typeof body.userText === "string" ? body.userText : null,
    turnIndex: typeof body.turnIndex === "number" ? body.turnIndex : 0,
  };

  try {
    const result = await runTurn(input);
    return Response.json(result, { status: 200 });
  } catch (err) {
    // Never let the phone page hang — return a safe fallback
    console.error("[/api/turn] unhandled error:", err);
    return Response.json(
      {
        reply: "Sorry, could you say that again?",
        end_call: false,
        emergency: false,
      },
      { status: 200 },
    );
  }
}
