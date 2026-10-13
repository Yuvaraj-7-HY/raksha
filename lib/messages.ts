// lib/messages.ts
// Formats the final Telegram message text for each alert type.
// The app builds the text; n8n just routes and sends it.

export type AlertData = {
  patientName?: string;
  time?: string;            // formatted local time string
  medLine?: string;         // e.g. "Morning medicines taken ✅"
  symptomLine?: string;     // e.g. "mild dizziness"
  severity?: string;
  followUpTime?: string;
  symptom?: string;
  summary?: string;
  attempts?: number;
  quote?: string;           // short quote for urgent
};

function nowIST(): string {
  return new Date().toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    day: "numeric",
    month: "short",
  });
}

export function formatAlert(
  type: "urgent" | "precaution" | "needs_attention" | "resolved" | "missed",
  data: AlertData,
): string {
  const name = data.patientName ?? "Grandma";
  const time = data.time ?? nowIST();

  switch (type) {
    case "precaution":
      return [
        `${name}: Health update (${time})`,
        data.medLine ?? "",
        `⚠️ ${data.symptomLine ?? "Symptom reported"}`,
        `AI asked follow-up questions; she described it as ${data.severity ?? "mild"}.`,
        data.followUpTime
          ? `🔄 Follow-up scheduled for ~${data.followUpTime}.`
          : "🔄 Follow-up call scheduled.",
        "No immediate action required.",
      ]
        .filter(Boolean)
        .join("\n");

    case "resolved":
      return [
        `${name}: Follow-up complete (${time})`,
        `✅ ${data.symptom ?? "Earlier concern"} has improved`,
        data.medLine ? `✅ ${data.medLine}` : "",
        "No action needed.",
      ]
        .filter(Boolean)
        .join("\n");

    case "needs_attention":
      return [
        `${name}: Needs attention (${time})`,
        `⚠️ ${data.symptom ?? "Symptom"} reported as worse than earlier.`,
        "Please call her.",
      ].join("\n");

    case "missed":
      return [
        `${name}: Missed check-in`,
        `She did not answer the scheduled call after ${data.attempts ?? 3} attempts.`,
        "Please check on her.",
      ].join("\n");

    case "urgent":
      return [
        `🚨 URGENT: ${name}`,
        `During the call she reported: "${data.quote ?? data.summary ?? "an emergency"}"`,
        "Emergency escalation has been triggered. Please contact her immediately.",
      ].join("\n");
  }
}
