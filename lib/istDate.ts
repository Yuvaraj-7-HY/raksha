// lib/istDate.ts
// Timezone helper for Asia/Kolkata (IST = UTC+05:30)

export const TIMEZONE_IST = "Asia/Kolkata";

/**
 * Returns current date in Asia/Kolkata formatted as YYYY-MM-DD
 */
export function getTodayIst(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE_IST,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/**
 * Formats any Date or ISO timestamp into YYYY-MM-DD in Asia/Kolkata
 */
export function toIstDateString(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE_IST,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

/**
 * Formats a Date/timestamp into friendly IST display (e.g. "14 Oct, 05:30 AM")
 */
export function formatIstDateTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: TIMEZONE_IST,
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(d);
}

/**
 * Calculates calendar days difference between an ISO date and today in IST
 */
export function daysAgoInIst(isoDate: string): number {
  const todayStr = getTodayIst();
  const dateStr = toIstDateString(isoDate);

  const todayMidnight = new Date(`${todayStr}T00:00:00+05:30`).getTime();
  const dateMidnight = new Date(`${dateStr}T00:00:00+05:30`).getTime();

  return Math.floor((todayMidnight - dateMidnight) / (1000 * 60 * 60 * 24));
}
