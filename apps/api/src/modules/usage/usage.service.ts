import { and, eq, gt, sql } from 'drizzle-orm';

import { env } from '../../config/env';
import { db } from '../../db';
import { dailyUsage, devices, subscriptions } from '../../db/schema';
import { getResetsAt, getUsageDateString, remainingSeconds } from '../../lib/quota';
import type { HeartbeatInput } from './usage.schemas';

// ---------------------------------------------------------------------------
// Shared quota result type — returned by usage endpoints and attached to
// feed responses. Also consumed by the quotaGuard middleware.
// ---------------------------------------------------------------------------

export interface QuotaStatus {
  /** True when the user has an active subscription (FR21). */
  unlimited: boolean;
  /** null when unlimited. */
  remainingSeconds: number | null;
  dailyLimitSeconds: number | null;
  /** ISO string of when the free time resets. null when unlimited. */
  resetsAt: string | null;
  /** True when remaining < QUOTA_WARNING_SECONDS (FR18). */
  warning: boolean;
}

// ---------------------------------------------------------------------------
// FR16 — Device registration
// ---------------------------------------------------------------------------

/**
 * FR16: upsert the device row identified by the X-Device-Id header.
 * Creates it on first call; updates lastSeenAt on subsequent calls.
 *
 * SWE applied:
 *  - Idempotency: safe to call on every app launch, not just the first.
 *  - Fail Fast: the device middleware already validated the UUID format;
 *    this function trusts that the caller checked req.deviceId is set.
 */
export async function registerDevice(deviceId: string): Promise<void> {
  await db
    .insert(devices)
    .values({ id: deviceId })
    .onConflictDoUpdate({
      target: devices.id,
      set: { lastSeenAt: sql`now()` },
    });
}

// ---------------------------------------------------------------------------
// FR15 — Usage heartbeat
// ---------------------------------------------------------------------------

/**
 * FR15: add elapsed viewing seconds to today's total.
 *
 * Rules:
 *  - Elapsed is capped at USAGE_HEARTBEAT_MAX_GAP_SECONDS (NFR8, anti-abuse).
 *  - Server time is used to determine today's date (FR17).
 *  - If the user is logged in, we upsert both a device row and a user row,
 *    so quota is tracked under both subjects (BR3).
 *
 * SWE applied:
 *  - Single Responsibility: only records time; quota enforcement is in quotaGuard.
 *  - DRY: upsertUsage is a shared private helper used for both device and user rows.
 *  - NFR12 — Configurability: cap comes from env, not hard-coded.
 */
export async function recordHeartbeat(
  input: HeartbeatInput,
  deviceId: string | undefined,
  userId: string | undefined,
): Promise<QuotaStatus> {
  const now = new Date();
  const usageDate = getUsageDateString(now, env.QUOTA_RESET_UTC_OFFSET_MINUTES);
  const addSeconds = Math.min(input.elapsed, env.USAGE_HEARTBEAT_MAX_GAP_SECONDS);

  if (deviceId) await upsertUsage({ deviceId, usageDate, addSeconds, now });
  if (userId) await upsertUsage({ userId, usageDate, addSeconds, now });

  return computeQuotaStatus({ deviceId, userId, now });
}

// ---------------------------------------------------------------------------
// FR14 — Get today's quota status
// ---------------------------------------------------------------------------

/**
 * FR14: return how much free time remains today without modifying any state.
 *
 * SWE applied:
 *  - Command–Query Separation: pure read, no side effects.
 */
export async function getTodayQuota(
  deviceId: string | undefined,
  userId: string | undefined,
): Promise<QuotaStatus> {
  const now = new Date();
  return computeQuotaStatus({ deviceId, userId, now });
}

// ---------------------------------------------------------------------------
// Core: computeQuotaStatus — used by heartbeat, today endpoint, and quotaGuard
// ---------------------------------------------------------------------------

/**
 * Computes the full quota status for the given subject.
 *
 * SWE applied:
 *  - DRY: single authoritative implementation; quotaGuard, heartbeat and
 *    GET /usage/today all call this — no duplicated quota logic.
 *  - BR1: active subscription check runs first (cheapest path, short-circuit).
 *  - BR3: for members, MAX(deviceSeconds, userSeconds) is applied.
 *  - FR17: uses server time only (now is passed in, never from client).
 */
export async function computeQuotaStatus(params: {
  deviceId: string | undefined;
  userId: string | undefined;
  now: Date;
}): Promise<QuotaStatus> {
  const { deviceId, userId, now } = params;

  // BR1 / FR21: check for an active subscription first.
  if (userId) {
    const [activeSub] = await db
      .select({ id: subscriptions.id })
      .from(subscriptions)
      .where(
        and(
          eq(subscriptions.userId, userId),
          eq(subscriptions.status, 'active'),
          gt(subscriptions.endDate, now),
        ),
      )
      .limit(1);

    if (activeSub) {
      return {
        unlimited: true,
        remainingSeconds: null,
        dailyLimitSeconds: null,
        resetsAt: null,
        warning: false,
      };
    }
  }

  const usageDate = getUsageDateString(now, env.QUOTA_RESET_UTC_OFFSET_MINUTES);
  const resetsAt = getResetsAt(now, env.QUOTA_RESET_UTC_OFFSET_MINUTES);

  // Fetch device seconds and user seconds in parallel (independent reads).
  const [deviceRow, userRow] = await Promise.all([
    deviceId
      ? db
          .select({ secondsUsed: dailyUsage.secondsUsed })
          .from(dailyUsage)
          .where(and(eq(dailyUsage.deviceId, deviceId), eq(dailyUsage.usageDate, usageDate)))
          .limit(1)
          .then((r) => r[0])
      : Promise.resolve(undefined),

    userId
      ? db
          .select({ secondsUsed: dailyUsage.secondsUsed })
          .from(dailyUsage)
          .where(and(eq(dailyUsage.userId, userId), eq(dailyUsage.usageDate, usageDate)))
          .limit(1)
          .then((r) => r[0])
      : Promise.resolve(undefined),
  ]);

  // BR3: for members, take the larger of the two totals.
  const deviceSeconds = deviceRow?.secondsUsed ?? 0;
  const userSeconds = userRow?.secondsUsed ?? 0;
  const secondsUsed = Math.max(deviceSeconds, userSeconds);

  const remaining = remainingSeconds(secondsUsed, env.DAILY_FREE_SECONDS);

  return {
    unlimited: false,
    remainingSeconds: remaining,
    dailyLimitSeconds: env.DAILY_FREE_SECONDS,
    resetsAt: resetsAt.toISOString(),
    warning: remaining > 0 && remaining <= env.QUOTA_WARNING_SECONDS, // FR18
  };
}

// ---------------------------------------------------------------------------
// Private helper
// ---------------------------------------------------------------------------

async function upsertUsage(params: {
  deviceId?: string;
  userId?: string;
  usageDate: string;
  addSeconds: number;
  now: Date;
}): Promise<void> {
  const { deviceId, userId, usageDate, addSeconds, now } = params;

  await db
    .insert(dailyUsage)
    .values({
      deviceId: deviceId ?? null,
      userId: userId ?? null,
      usageDate,
      secondsUsed: addSeconds,
      lastHeartbeatAt: now,
    })
    .onConflictDoUpdate({
      target: deviceId ? dailyUsage.deviceId : dailyUsage.userId,
      targetWhere: deviceId
        ? eq(dailyUsage.usageDate, usageDate)
        : eq(dailyUsage.usageDate, usageDate),
      set: {
        secondsUsed: sql`${dailyUsage.secondsUsed} + ${addSeconds}`,
        lastHeartbeatAt: now,
      },
    });
}
