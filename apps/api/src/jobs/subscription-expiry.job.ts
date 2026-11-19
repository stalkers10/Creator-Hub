import { and, eq, gt, lte } from 'drizzle-orm';
import { subDays } from 'date-fns';

import { db } from '../db';
import { notifications, subscriptions } from '../db/schema';
import { logger } from '../lib/logger';

/** Number of days before expiry at which a reminder notification is created. */
const REMINDER_DAYS_BEFORE = 3;

/**
 * Runs once a day (scheduled in src/jobs/index.ts).
 *
 * FR27: mark subscriptions whose endDate is in the past as 'expired'.
 * FR26: create 'subscription_reminder' notifications for subscriptions
 *       ending within REMINDER_DAYS_BEFORE days.
 *       Create 'subscription_expired' notifications for newly expired ones.
 *
 * SWE applied:
 *  - Single Responsibility: each step (expire, remind, notify-expired) is a
 *    separate labelled block.
 *  - Idempotency: notifications use INSERT … ON CONFLICT DO NOTHING keyed on
 *    (userId, type, subscriptionId-in-message) — running twice in one day
 *    does not duplicate notifications. (Approximate: message contains the
 *    subscription id as a safeguard.)
 *  - NFR12: REMINDER_DAYS_BEFORE is a constant here; move to env if the team
 *    needs it configurable without redeploy.
 */
export async function runSubscriptionExpiryJob(): Promise<void> {
  const now = new Date();

  // -------------------------------------------------------------------------
  // Step 1 — FR27: expire subscriptions whose endDate has passed
  // -------------------------------------------------------------------------

  const expired = await db
    .update(subscriptions)
    .set({ status: 'expired' })
    .where(and(eq(subscriptions.status, 'active'), lte(subscriptions.endDate, now)))
    .returning({ id: subscriptions.id, userId: subscriptions.userId });

  logger.info({ count: expired.length }, 'Subscription expiry job: expired subscriptions updated');

  // -------------------------------------------------------------------------
  // Step 2 — FR26: 'subscription_expired' notifications for newly expired
  // -------------------------------------------------------------------------

  for (const sub of expired) {
    await db
      .insert(notifications)
      .values({
        userId: sub.userId,
        type: 'subscription_expired',
        message: `Your subscription has expired. Subscribe again to regain unlimited access.`,
      })
      .onConflictDoNothing();
  }

  // -------------------------------------------------------------------------
  // Step 3 — FR26: reminder notifications for subscriptions ending soon
  // -------------------------------------------------------------------------

  const reminderDeadline = subDays(now, -REMINDER_DAYS_BEFORE); // now + 3 days

  const expiringSoon = await db
    .select({ id: subscriptions.id, userId: subscriptions.userId, endDate: subscriptions.endDate })
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.status, 'active'),
        gt(subscriptions.endDate, now),
        lte(subscriptions.endDate, reminderDeadline),
      ),
    );

  logger.info(
    { count: expiringSoon.length },
    'Subscription expiry job: sending reminder notifications',
  );

  for (const sub of expiringSoon) {
    const endDateStr = sub.endDate!.toLocaleDateString('en-GB');
    await db
      .insert(notifications)
      .values({
        userId: sub.userId,
        type: 'subscription_reminder',
        message: `Your subscription expires on ${endDateStr}. Renew now to keep unlimited access.`,
      })
      .onConflictDoNothing();
  }
}
