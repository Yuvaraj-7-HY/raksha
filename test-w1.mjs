// test-w1.mjs — verify n8n W1 care-turn webhook
// Run: node --env-file=.env.local test-w1.mjs

import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

import { config } from "dotenv";
config({ path: resolve(__dirname, ".env.local") });

const N8N_BASE_URL = process.env.N8N_BASE_URL ?? "http://localhost:5678";
const CARE_SHARED_SECRET = process.env.CARE_SHARED_SECRET;

const PROD_URL = `${N8N_BASE_URL}/webhook/care-turn`;
const TEST_URL = `${N8N_BASE_URL}/webhook-test/care-turn`;

console.log("N8N_BASE_URL:", N8N_BASE_URL);
console.log("Secret check:", CARE_SHARED_SECRET === "ced44b48478735301fc97c660ed1ac9e35e70f8f7e7a3466de488303c5aa0d1b" ? "MATCHES .env.local" : "MISMATCH!");

async function testUrl(url, label) {
  console.log(`\n=== ${label} ===`);
  console.log("URL:", url);
  const turn0 = {
    callId: "test-preflight-" + Date.now(),
    callType: "morning",
    context: "Morning medication check. Ask how she is feeling and whether she took her morning medicines.",
    history: [],
    userText: null,
    turnIndex: 0,
  };

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Care-Secret": CARE_SHARED_SECRET,
      },
      body: JSON.stringify(turn0),
    });

    console.log("Status:", res.status);
    console.log("Headers:", Object.fromEntries(res.headers.entries()));
    const text = await res.text();
    console.log("Raw body length:", text.length);
    console.log("Raw body:", text || "(empty)");

    if (!text) {
      console.log("→ Empty response — check Respond to Webhook node is connected and returns JSON");
      return false;
    }

    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      console.log("→ Invalid JSON:", e.message);
      return false;
    }

    console.log("Parsed:", JSON.stringify(data, null, 2));

    const required = ["reply", "end_call", "emergency", "llm_ok"];
    for (const key of required) {
      if (!(key in data)) {
        console.log(`→ Missing required field: ${key}`);
        return false;
      }
    }
    console.log("→ PASS: All required fields present");
    return true;
  } catch (e) {
    console.log("→ Request error:", e.message);
    return false;
  }
}

async function main() {
  console.log("\nTesting both URLs...\n");

  const testOk = await testUrl(TEST_URL, "TEST URL (/webhook-test/)");
  const prodOk = await testUrl(PROD_URL, "PRODUCTION URL (/webhook/)");

  console.log("\n=== SUMMARY ===");
  console.log("Test URL:", testOk ? "PASS" : "FAIL");
  console.log("Prod URL:", prodOk ? "PASS" : "FAIL");

  if (!testOk && !prodOk) {
    console.log("\nTROUBLESHOOTING:");
    console.log("1. Test URL 200 + empty body → Respond to Webhook node not connected or not returning JSON");
    console.log("2. Prod URL 403 → Webhook node Header Auth value doesn't match .env.local secret");
    console.log("3. Check: Webhook node → Authentication → Header Auth → Header Value = exact secret");
    console.log("4. Check: Workflow is SAVED and ACTIVE (toggle top-right)");
    console.log("5. Check: Respond to Webhook node → Response Format: JSON, Response Code: 200");
    return false;
  }
  return true;
}

main().then((ok) => {
  process.exit(ok ? 0 : 1);
});