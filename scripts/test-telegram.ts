// scripts/test-telegram.ts
// Quick smoke-test: sends one message to FAMILY_CHAT_ID.
// Usage:  npm run test:telegram

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// ── Load .env.local BEFORE any other imports that read process.env ────────────
function loadEnvLocal() {
  try {
    const file = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
    for (const line of file.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      const raw = trimmed.slice(eq + 1).trim();
      // Strip inline comments (e.g. "value  # comment")
      const val = raw.split(/\s+#/)[0].trim();
      if (!(key in process.env)) process.env[key] = val;
    }
    console.log("✅ Loaded .env.local");
  } catch {
    console.warn("⚠️  No .env.local found — relying on shell env");
  }
}
loadEnvLocal();

// ── Now read values directly from process.env ─────────────────────────────────
const TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? "";
const FAMILY = process.env.FAMILY_CHAT_ID ?? "";
const EMERGENCY = process.env.EMERGENCY_CHAT_ID ?? FAMILY;

async function sendMsg(chatId: string, text: string): Promise<boolean> {
  if (!TOKEN || !chatId) {
    console.error("Missing token or chatId. TOKEN:", TOKEN ? "set" : "MISSING", "chatId:", chatId || "MISSING");
    return false;
  }
  const res = await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
  const json = await res.json() as { ok: boolean; description?: string };
  if (!json.ok) console.error("Telegram error:", json.description);
  return json.ok;
}

async function main() {
  console.log("\n── Telegram smoke test ──────────────────────");
  console.log("TOKEN :", TOKEN ? TOKEN.slice(0, 10) + "..." : "MISSING ❌");
  console.log("FAMILY:", FAMILY || "MISSING ❌");
  console.log("EMERG :", EMERGENCY || "MISSING ❌");
  console.log("─────────────────────────────────────────────\n");

  const ok = await sendMsg(FAMILY, "🟢 RAKSHA test — Telegram is working! (C2 ✅)");
  if (ok) {
    console.log("✅ Message delivered to family chat.");
  } else {
    console.error("❌ Failed. Fix token/chat ID and retry.");
    process.exit(1);
  }

  if (EMERGENCY && EMERGENCY !== FAMILY) {
    const ok2 = await sendMsg(EMERGENCY, "🔴 RAKSHA URGENT test — emergency chat reachable.");
    console.log(ok2 ? "✅ Emergency chat also reached." : "❌ Emergency chat failed.");
  } else {
    console.log("ℹ️  EMERGENCY_CHAT_ID same as FAMILY — skipping duplicate send.");
  }
}

main().catch((e) => { console.error("Fatal:", e); process.exit(1); });
