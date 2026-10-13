const N8N_BASE_URL = process.env.N8N_BASE_URL ?? "http://localhost:5678";
const N8N_WEBHOOK_PREFIX = process.env.N8N_WEBHOOK_PREFIX ?? "webhook-test";
const CARE_SHARED_SECRET = process.env.CARE_SHARED_SECRET ?? "change-me";

export function n8nWebhookUrl(path: string): string {
  const clean = path.replace(/^\/+/, "");
  return `${N8N_BASE_URL}/${N8N_WEBHOOK_PREFIX}/${clean}`;
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

export function careSecretFromRequest(req: Request): string {
  return req.headers.get("x-care-secret") ?? "";
}

export function careSecretMatches(req: Request): boolean {
  const expected = process.env.CARE_SHARED_SECRET ?? "change-me";
  return careSecretFromRequest(req) === expected;
}
