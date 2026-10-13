// lib/brain/turn.ts
// Conversation turn — port of the old n8n W1 workflow.
// Called directly from /api/turn.

import { groqChat, parseGroqJson, type GroqMessage } from "../groq";
import { sendAlert } from "../alerts";
import { formatAlert } from "../messages";
import {
  EMERGENCY_KEYWORDS,
  MAX_CALL_TURNS,
} from "../config";

export type HistoryItem = { role: string; text: string; ts?: number };

export type TurnInput = {
  callId: string;
  callType: string;   // morning | evening | followup
  context: string;
  history: HistoryItem[];
  userText: string | null;
  turnIndex: number;
};

export type TurnOutput = {
  reply: string;
  end_call: boolean;
  emergency: boolean;
};

// ── Fallback replies ──────────────────────────────────────────────────────────
const FALLBACK_NORMAL = "Sorry, could you say that again?";
const FALLBACK_EMERGENCY =
  "I am letting your family know right now. Please stay where you are. Are you safe?";
const FALLBACK_GOODBYE = "Thank you, Grandma. Take care. Goodbye.";

// ── Keyword check ─────────────────────────────────────────────────────────────
export function hasEmergencyKeyword(text: string): boolean {
  const lower = text.toLowerCase();
  return EMERGENCY_KEYWORDS.some((kw) => lower.includes(kw));
}

// ── Medication slot derived from call type ────────────────────────────────────
function medicationSlot(callType: string): string {
  if (callType === "evening") return "evening";
  if (callType === "followup") return "evening"; // followup happens after morning
  return "morning";
}

// ── System prompt ─────────────────────────────────────────────────────────────
function buildSystemPrompt(input: TurnInput): string {
  const slot = medicationSlot(input.callType);
  return `You are a warm, patient AI care companion making a phone call to Grandma, a 72-year-old who lives alone in Mysore. You call on behalf of her family. This is a real-sounding phone call, so everything you say will be spoken aloud.

CALL TYPE: ${input.callType}
KNOWN CONTEXT (use it, do not ask again about things already known): ${input.context || "None"}

HOW TO SPEAK
- Short, simple, kind sentences. Maximum 2 sentences per turn (about 25 words). No lists, no jargon, no emojis.
- Ask ONE question at a time. Speak slowly and clearly. Be gentle and unhurried.
- Address her as "Grandma" unless the context says otherwise.

GOALS FOR THIS CALL
- morning/evening call: greet her, ask how she is feeling, and ask whether she took her ${slot} medicines.
- followup call: greet her, ask how she is feeling now about the earlier concern in the context, then ask whether she took her medicines due since then.
- First turn (no user text yet): give the greeting that fits the call type and ask the first question.

IF SHE MENTIONS A SYMPTOM OR PROBLEM
- Ask at most TWO gentle follow-up questions: how bad it is (mild or severe) and whether it just started or has been going on.
- Then acknowledge calmly. You may say you will let the family know and check on her again later, but do not promise specific times.

IF SHE MENTIONS AN EMERGENCY (a fall, cannot get up, chest pain, trouble breathing, severe pain, confusion, bleeding, feeling faint)
- Stop the normal check-in. Say calmly: you are letting her family know right now, and ask her to stay where she is. Ask if she is safe or if anyone is with her. Keep the line open. Do not end the call.

STRICT SAFETY RULES
- NEVER diagnose, guess causes, or name conditions.
- NEVER advise taking, skipping, delaying, or changing any medicine or dose. NEVER suggest remedies.
- If she asks a medical question: say it is a good question for her doctor and that you will let her family know.
- Do not claim to be human. If asked, say you are an AI assistant calling on behalf of her family.

ENDING THE CALL
- Once you know (a) whether she took her medicine and (b) how she is feeling, plus any symptom follow-ups, say a warm short goodbye and set end_call to true.

OUTPUT: respond with ONLY valid JSON, no markdown:
{"reply": "<what you say aloud>", "end_call": false}`;
}

// ── History → Groq messages ───────────────────────────────────────────────────
function historyToMessages(history: HistoryItem[]): GroqMessage[] {
  return history.map((h) => ({
    role: (h.role === "ai" ? "assistant" : "user") as "assistant" | "user",
    content: h.text,
  }));
}

// ── Main export ───────────────────────────────────────────────────────────────
export async function runTurn(input: TurnInput): Promise<TurnOutput> {
  const normalizedUser = input.userText
    ? input.userText
        .toLowerCase()
        .replace(/[\u2018\u2019]/g, "'")
        .trim()
    : null;

  // ── 1. Keyword check (before LLM) ────────────────────────────────────────
  let emergency = false;
  if (normalizedUser && hasEmergencyKeyword(normalizedUser)) {
    emergency = true;
    // Fire-and-forget alert (deduped inside sendAlert)
    sendAlert(
      "urgent",
      formatAlert("urgent", {
        quote: input.userText?.slice(0, 120),
      }),
      input.callId,
    ).catch((e) => console.error("[turn] sendAlert failed:", e));
  }

  // ── 2. Build messages ─────────────────────────────────────────────────────
  const systemPrompt = buildSystemPrompt(input);

  // De-duplicate: drop last history item if it matches the current userText
  const history = [...input.history];
  if (
    normalizedUser &&
    history.length > 0 &&
    history[history.length - 1].role === "grandma" &&
    history[history.length - 1].text.toLowerCase().trim() === normalizedUser
  ) {
    history.pop();
  }

  const messages: GroqMessage[] = [
    { role: "system", content: systemPrompt },
    ...historyToMessages(history),
  ];

  if (input.turnIndex === 0 && !normalizedUser) {
    // First turn — prompt the model to produce the opening greeting
    messages.push({
      role: "user",
      content:
        "The call just connected. Please greet Grandma warmly and ask your first question now.",
    });
  } else if (normalizedUser) {
    messages.push({ role: "user", content: normalizedUser });
  }

  // ── 3. Call Groq ──────────────────────────────────────────────────────────
  const result = await groqChat(messages, 6000);

  // ── 4. Parse response ─────────────────────────────────────────────────────
  type GroqTurnResponse = { reply?: string; end_call?: boolean };
  let reply = "";
  let end_call = false;

  if (result.ok) {
    const parsed = parseGroqJson<GroqTurnResponse>(result.text);
    if (parsed && typeof parsed.reply === "string" && parsed.reply.trim()) {
      reply = parsed.reply.trim();
      end_call = Boolean(parsed.end_call);
    } else {
      console.warn("[turn] Groq returned unparseable JSON:", result.text.slice(0, 200));
    }
  } else {
    console.warn("[turn] Groq error:", result.error);
  }

  // ── 5. Fallbacks ──────────────────────────────────────────────────────────
  if (!reply) {
    if (input.turnIndex >= MAX_CALL_TURNS - 1) {
      reply = FALLBACK_GOODBYE;
    } else if (emergency) {
      reply = FALLBACK_EMERGENCY;
    } else {
      reply = FALLBACK_NORMAL;
    }
  }

  // ── 6. Force caps ─────────────────────────────────────────────────────────
  if (input.turnIndex >= MAX_CALL_TURNS) end_call = true;
  if (emergency) end_call = false; // keep the line open during emergencies

  return { reply, end_call, emergency };
}
