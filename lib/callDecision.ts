// lib/callDecision.ts
// Pure decision logic for IVR medication adherence check:
// Evaluates (digit + attempt_no) => "taken" | "retry" | "escalate"

export type MedicationDecision = "taken" | "retry" | "escalate" | "invalid";

export interface DecisionResult {
  decision: MedicationDecision;
  nextAttemptNo: number | null;
  message: string;
}

/**
 * Pure decision function:
 * - Digit "1" (Yes) => "taken" (resolved, no retry)
 * - Digit "2" (No) with attempt < maxAttempts => "retry" (recheck scheduled)
 * - Digit "2" (No) with attempt >= maxAttempts => "escalate" (caretaker alert)
 * - Any other input => "invalid"
 */
export function evaluateMedicationCheckDecision(
  digit: string,
  attemptNo: number = 1,
  maxAttempts: number = 2
): DecisionResult {
  if (digit === "1") {
    return {
      decision: "taken",
      nextAttemptNo: null,
      message: "Patient confirmed taking medicine. Check-in resolved.",
    };
  }

  if (digit === "2") {
    if (attemptNo < maxAttempts) {
      return {
        decision: "retry",
        nextAttemptNo: attemptNo + 1,
        message: `Patient indicated medicine not taken yet. Retry scheduled (attempt #${attemptNo + 1}).`,
      };
    } else {
      return {
        decision: "escalate",
        nextAttemptNo: null,
        message: `Patient confirmed medicine not taken after ${attemptNo} attempts. Escalating to caregiver.`,
      };
    }
  }

  return {
    decision: "invalid",
    nextAttemptNo: attemptNo < maxAttempts ? attemptNo + 1 : null,
    message: "Invalid or unrecognized input. Escalating or repeating.",
  };
}
