// scripts/test-call-decision.ts
// Unit test for the pure decision function: (digit + attempt_no => taken | retry | escalate)

import { evaluateMedicationCheckDecision } from "../lib/callDecision";

let passed = 0;
let failed = 0;

function assert(condition: boolean, msg: string) {
  if (condition) {
    console.log(`  ✅ PASS: ${msg}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${msg}`);
    failed++;
  }
}

console.log("\n🧪 Running Medication Call Decision Unit Tests...\n");

// Case 1: Press 1 (Yes) -> Taken (resolved)
{
  const res = evaluateMedicationCheckDecision("1", 1, 2);
  assert(res.decision === "taken" && res.nextAttemptNo === null, "Digit 1 (Yes) resolves as 'taken' without retry");
}

// Case 2: Press 2 (No) on Attempt 1 -> Retry (recheck scheduled)
{
  const res = evaluateMedicationCheckDecision("2", 1, 2);
  assert(res.decision === "retry" && res.nextAttemptNo === 2, "Digit 2 (No) on attempt 1 schedules a 'retry' for attempt 2");
}

// Case 3: Press 2 (No) on Attempt 2 (Max attempts = 2) -> Escalate
{
  const res = evaluateMedicationCheckDecision("2", 2, 2);
  assert(res.decision === "escalate" && res.nextAttemptNo === null, "Digit 2 (No) on attempt 2 triggers 'escalate' to caregiver");
}

// Case 4: Press 2 (No) on Attempt 3 (Max attempts = 3) -> Escalate
{
  const res = evaluateMedicationCheckDecision("2", 3, 3);
  assert(res.decision === "escalate" && res.nextAttemptNo === null, "Digit 2 (No) on attempt 3 (max=3) triggers 'escalate' to caregiver");
}

// Case 5: Invalid key -> Invalid
{
  const res = evaluateMedicationCheckDecision("9", 1, 2);
  assert(res.decision === "invalid", "Invalid digit returns 'invalid'");
}

console.log(`\nDecision Test Results: ${passed} passed, ${failed} failed.\n`);
if (failed > 0) process.exit(1);
