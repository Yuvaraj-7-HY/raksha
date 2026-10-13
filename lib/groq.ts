// lib/groq.ts
// Thin wrapper around the Groq chat completions API.
// Always uses JSON mode and enforces a hard timeout via AbortController.

import { GROQ_API_KEY, GROQ_MODEL } from "./config";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

export type GroqMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type GroqResult = {
  ok: true;
  text: string;   // raw string from the model (may be JSON)
} | {
  ok: false;
  error: string;
};

/**
 * Call Groq chat completions in JSON mode.
 * @param messages  Full message array (system + history + user)
 * @param timeoutMs Hard abort timeout (default 6 000 ms)
 */
export async function groqChat(
  messages: GroqMessage[],
  timeoutMs = 6000,
): Promise<GroqResult> {
  if (!GROQ_API_KEY) {
    return { ok: false, error: "GROQ_API_KEY not set" };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(GROQ_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages,
        temperature: 0.4,
        max_tokens: 150,
        response_format: { type: "json_object" },
      }),
      signal: controller.signal,
      cache: "no-store",
    });

    if (!res.ok) {
      const body = await res.text();
      return { ok: false, error: `Groq ${res.status}: ${body.slice(0, 200)}` };
    }

    const data = (await res.json()) as {
      choices: { message: { content: string } }[];
    };
    const text = data.choices?.[0]?.message?.content ?? "";
    return { ok: true, text };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg.includes("abort") ? "timeout" : msg };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Strip markdown code fences and parse JSON from a Groq response.
 * Returns null on any parse failure.
 */
export function parseGroqJson<T>(raw: string): T | null {
  try {
    // Remove ```json ... ``` or ``` ... ``` fences
    const stripped = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
    return JSON.parse(stripped) as T;
  } catch {
    return null;
  }
}
