import { careSecretMatches } from "@/lib/n8n";
import { tryStartRing } from "@/lib/ringState";

export async function POST(req: Request) {
  if (!careSecretMatches(req)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: {
    callId?: string;
    callType?: string;
    context?: string;
    attempt?: number;
  };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }

  const callId = body.callId?.trim();
  if (!callId) {
    return Response.json({ error: "callId required" }, { status: 400 });
  }

  const result = tryStartRing({
    callId,
    callType: body.callType?.trim() || "morning",
    context: body.context?.trim() || "",
    attempt: typeof body.attempt === "number" ? body.attempt : 0,
  });

  if (!result.ok) {
    return Response.json({ error: "phone busy" }, { status: 409 });
  }

  return Response.json({ ok: true, state: result.state }, { status: 200 });
}
