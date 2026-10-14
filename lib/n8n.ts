const N8N_BASE_URL = process.env.N8N_BASE_URL ?? "http://localhost:5678";
const N8N_WEBHOOK_PREFIX = process.env.N8N_WEBHOOK_PREFIX ?? "webhook";
const CARE_SHARED_SECRET = process.env.CARE_SHARED_SECRET ?? "2ea1c4261d21c5a1ecfac162fd6c141cbc2fd30341508a9dce9f9ed241674b82";
const N8N_LEGACY_SECRET = "ced44b48478735301fc97c660ed1ac9e35e70f8f7e7a3466de488303c5aa0d1b";

export function n8nWebhookUrl(path: string, prefix = N8N_WEBHOOK_PREFIX): string {
  const clean = path.replace(/^\/+/, "");
  return `${N8N_BASE_URL}/${prefix}/${clean}`;
}

export async function callN8nWebhook<T>(
  path: string,
  body: unknown,
  timeoutMs = 8000,
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(n8nWebhookUrl(path), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Care-Secret": CARE_SHARED_SECRET,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
      cache: "no-store",
    });
    if (!res.ok) {
      throw new Error(`n8n ${path} responded ${res.status}`);
    }
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

export interface N8nCareTurnInput {
  callId: string;
  callType?: string;
  context?: string;
  history?: Array<{ role: "assistant" | "user"; text: string }>;
  userText: string | null;
  turnIndex: number;
  patient_id?: string;
  patient_name?: string;
}

export interface N8nCareTurnOutput {
  reply: string;
  end_call?: boolean;
  emergency?: boolean;
  llm_ok?: boolean;
}

/**
 * Sends spoken transcription to n8n care-turn webhook and gets the reply.
 * Handles fallback gracefully if n8n is offline or returns an unexpected format.
 */
export async function callN8nCareTurn(input: N8nCareTurnInput): Promise<N8nCareTurnOutput> {
  const secrets = [CARE_SHARED_SECRET, N8N_LEGACY_SECRET];
  const endpoints = [
    n8nWebhookUrl("care-turn", "webhook"),
    n8nWebhookUrl("care-turn", "webhook-test"),
  ];

  for (const url of endpoints) {
    for (const secret of secrets) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);

        const res = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Care-Secret": secret,
          },
          body: JSON.stringify(input),
          signal: controller.signal,
          cache: "no-store",
        });

        clearTimeout(timeout);

        if (res.ok) {
          const data = await res.json().catch(() => null);
          if (data && typeof data.reply === "string") {
            console.log(`[n8n] Care turn response from ${url}:`, data);
            return {
              reply: data.reply,
              end_call: Boolean(data.end_call),
              emergency: Boolean(data.emergency),
              llm_ok: Boolean(data.llm_ok),
            };
          }
        }
      } catch (err: any) {
        // Continue to next endpoint/secret
      }
    }
  }

  // Fallback if n8n is not reachable or workflow is inactive
  console.warn("[n8n] n8n webhook did not respond; using care brain fallback.");
  const lower = (input.userText || "").toLowerCase();
  let reply = "Thank you for letting me know. How are you feeling right now?";
  let endCall = false;

  if (lower.includes("yes") || lower.includes("took") || lower.includes("taken") || lower.includes("done")) {
    reply = "That is wonderful! Thank you for taking your medicines on time. Take care and have a wonderful day.";
    endCall = true;
  } else if (lower.includes("no") || lower.includes("not yet") || lower.includes("forgot") || lower.includes("haven't")) {
    reply = "Please remember to take your prescribed medicine soon as advised by your doctor. We will check back with you.";
    endCall = true;
  }

  return {
    reply,
    end_call: endCall,
    emergency: false,
    llm_ok: false,
  };
}

export function careSecretFromRequest(req: Request): string {
  return req.headers.get("x-care-secret") ?? "";
}

export function careSecretMatches(req: Request): boolean {
  const expected = process.env.CARE_SHARED_SECRET ?? "change-me";
  const reqSecret = careSecretFromRequest(req);
  return reqSecret === expected || reqSecret === N8N_LEGACY_SECRET;
}
