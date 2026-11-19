import { and, desc, eq, gt, or } from 'drizzle-orm';

import { db } from '../../db';
import { subscriptionPlans, subscriptions } from '../../db/schema';
import { forbidden, notFound } from '../../lib/errors';
import type { CreateSubscriptionInput } from './subscriptions.schemas';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PlanRow = typeof subscriptionPlans.$inferSelect;
export type SubscriptionRow = typeof subscriptions.$inferSelect;

// ---------------------------------------------------------------------------
// FR22 — List active plans
// ---------------------------------------------------------------------------

/**
 * FR22: return all plans where isActive = true.
 *
 * SWE applied:
 *  - Command–Query Separation: pure read, no side effects.
 *  - NFR12 — Configurability: plans live in the DB, not in code.
 */
export async function listActivePlans(): Promise<PlanRow[]> {
  return db.select().from(subscriptionPlans).where(eq(subscriptionPlans.isActive, true));
}

// ---------------------------------------------------------------------------
// FR23 — Create a pending subscription
// ---------------------------------------------------------------------------

/**
 * FR23: create a subscription record with status 'pending'.
 * The subscription is not activated until payment is confirmed (FR31).
 *
 * SWE applied:
 *  - Fail Fast: plan existence and active status checked before insert.
 *  - Single Responsibility: only creates the pending record; payment
 *    initiation is in payments.service.ts.
 */
export async function createPendingSubscription(
  userId: string,
  input: CreateSubscriptionInput,
): Promise<SubscriptionRow> {
  const [plan] = await db
    .select()
    .from(subscriptionPlans)
    .where(and(eq(subscriptionPlans.id, input.planId), eq(subscriptionPlans.isActive, true)))
    .limit(1);

  if (!plan) throw notFound('Subscription plan not found or no longer available');

  const [created] = await db
    .insert(subscriptions)
    .values({ userId, planId: input.planId, status: 'pending' })
    .returning();

  if (!created) throw new Error('Subscription insert returned no row');
  return created;
}

// ---------------------------------------------------------------------------
// FR24 / FR29 — My subscriptions
// ---------------------------------------------------------------------------

/**
 * FR24/FR29: return current and past subscriptions for the authenticated user.
 * Ordered newest first.
 */
export async function getUserSubscriptions(userId: string): Promise<SubscriptionRow[]> {
  return db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.userId, userId))
    .orderBy(desc(subscriptions.createdAt));
}

// ---------------------------------------------------------------------------
// FR28 — Cancel a subscription
// ---------------------------------------------------------------------------

/**
 * FR28: mark the subscription as cancelled.
 *
 * Access behaviour: the spec says "access remains until the end date already paid for".
 * The quotaGuard allows access when status IN ('active','cancelled') AND endDate > now.
 * We only flip the status — endDate is preserved.
 *
 * SWE applied:
 *  - Fail Fast: ownership + cancellable-status checked before update.
 *  - Defensive: only 'active' subscriptions can be cancelled (not 'pending' or 'expired').
 */
export async function cancelSubscription(
  subscriptionId: string,
  userId: string,
): Promise<SubscriptionRow> {
  const [sub] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.id, subscriptionId))
    .limit(1);

  if (!sub) throw notFound('Subscription not found');
  if (sub.userId !== userId) throw forbidden('You can only cancel your own subscriptions');
  if (sub.status !== 'active') {
    throw forbidden(`Cannot cancel a subscription with status '${sub.status}'`);
  }

  const [updated] = await db
    .update(subscriptions)
    .set({ status: 'cancelled' })
    .where(eq(subscriptions.id, subscriptionId))
    .returning();

  return updated!;
}

// ---------------------------------------------------------------------------
// Utility used by payments service (FR25 / BR4)
// ---------------------------------------------------------------------------

/**
 * Returns the latest active-or-cancelled subscription with a future endDate.
 * Used by the payment service to implement BR4 (chain start dates).
 */
export async function getLatestActiveSubscription(
  userId: string,
): Promise<SubscriptionRow | undefined> {
  const rows = await db
    .select()
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.userId, userId),
        or(eq(subscriptions.status, 'active'), eq(subscriptions.status, 'cancelled')),
        gt(subscriptions.endDate, new Date()),
      ),
    )
    .orderBy(desc(subscriptions.endDate))
    .limit(1);

  return rows[0];
}
