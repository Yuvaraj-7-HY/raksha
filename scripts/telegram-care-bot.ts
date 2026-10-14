// scripts/telegram-care-bot.ts
// Standalone runner for the Telegram Medication Adherence Care Bot
// Run with: npx tsx scripts/telegram-care-bot.ts

import dotenv from "dotenv";
dotenv.config();

import { startTelegramPoller } from "../lib/telegramPoller";
import { sendTelegramMedicationCheck } from "../lib/telegramCare";

async function main() {
  console.log("==================================================");
  console.log("🤖 RAKSHA TELEGRAM MEDICATION ADHERENCE BOT ACTIVE");
  console.log("==================================================");
  console.log("• Interactive options (Yes / No / Remind)");
  console.log("• 1-minute auto follow-up if answered 'No'");
  console.log("• 1-minute auto follow-up if NO response received");
  console.log("• Auto-escalation to caregiver after 2 failed attempts");
  console.log("• Supabase call_attempts, patients, & escalations updated");
  console.log("==================================================");

  // Start polling Telegram updates
  startTelegramPoller();

  // Send an immediate test medication check prompt
  console.log("\n📲 Sending a medication check prompt to your Telegram now...");
  const res = await sendTelegramMedicationCheck({
    patientId: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    patientName: "Ramesh Iyer",
    attemptNo: 1,
  });

  console.log(`Prompt sent! Check ID: ${res.checkId}`);
  console.log("Open Telegram and test by pressing Yes or No, or wait 1 min without replying!\n");
}

main().catch(console.error);
