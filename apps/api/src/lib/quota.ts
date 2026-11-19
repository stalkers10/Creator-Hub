/**
 * Pure time helpers for the daily free-time quota (FR14–FR20, NFR12).
 *
 * All functions are side-effect-free and depend only on their arguments,
 * making them trivially unit-testable without mocks.
 *
 * SWE applied:
 *  - Separation of Concerns: date/time math lives here, away from DB and HTTP.
 *  - Single Responsibility: each function does exactly one calculation.
 *  - Pure functions: same inputs always produce same outputs (referential transparency).
 */

/**
 * Returns the "local date string" (YYYY-MM-DD) for a given UTC instant,
 * shifted by the configured UTC offset in minutes.
 *
 * Example: if now = 2026-11-19T23:30:00Z and offsetMinutes = 60 (UTC+1),
 * the local time is 00:30 on 2026-11-20, so this returns "2026-11-20".
 */
export function getUsageDateString(now: Date, utcOffsetMinutes: number): string {
  const localMs = now.getTime() + utcOffsetMinutes * 60 * 1000;
  const local = new Date(localMs);
  const y = local.getUTCFullYear();
  const m = String(local.getUTCMonth() + 1).padStart(2, '0');
  const d = String(local.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Returns the UTC timestamp at which the quota resets for the next local day.
 *
 * That is: the next local midnight expressed in UTC.
 * e.g. for UTC+1, local midnight 2026-11-20T00:00 = 2026-11-19T23:00Z.
 */
export function getResetsAt(now: Date, utcOffsetMinutes: number): Date {
  const todayString = getUsageDateString(now, utcOffsetMinutes);
  const parts = todayString.split('-').map(Number);
  const y = parts[0]!;
  const m = parts[1]!;
  const d = parts[2]!;
  // Next local midnight = start of next local day.
  const nextLocalMidnightMs = Date.UTC(y, m - 1, d + 1) - utcOffsetMinutes * 60 * 1000;
  return new Date(nextLocalMidnightMs);
}

/**
 * Returns the remaining free seconds given the total used and the daily limit.
 * Always >= 0.
 */
export function remainingSeconds(secondsUsed: number, dailyFreeSeconds: number): number {
  return Math.max(0, dailyFreeSeconds - secondsUsed);
}
