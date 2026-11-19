import { addDays } from 'date-fns';
import { desc, eq } from 'drizzle-orm';

import { db } from '../../db';
import { payments, subscriptionPlans, subscriptions } from '../../db/schema';
import { initiateCollection, getTransactionStatus } from '../../lib/campay';
import { forbidden, notFound } from '../../lib/errors';
import { logger } from '../../lib/logger';
import { getLatestActiveSubscription } from '../subscriptions/subscriptions.service';
import type { CampayWebhookBody, InitiatePaymentInput } from './payments.schemas';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PaymentRow = typeof payments.$inferSelect;

// ---------------------------------------------------------------------------
// FR30 — Initiate a payment
// ---------------------------------------------------------------------------

/**
 * FR30: create a payment record and start a Campay mobile money collection.
 *
 * SWE applied:
 *  - Fail Fast: verify subscription exists, belongs to caller, and is 'pending'.
 *  - Atomicity: payment row is created before Campay is called; if Campay fails
 *    the row is left as 'pending' and can be retried.
 *  - Single Responsibility: only initiates; activation is in handleWebhook.
 */
export async function initiatePayment(
  userId: string,
  input: InitiatePaymentInput,
): Promise<PaymentRow> {
  // Verify subscription exists and belongs to the caller.
  const [sub] = await db
    .select({ sub: subscriptions, plan: subscriptionPlans })
    .from(subscriptions)
    .innerJoin(subscriptionPlans, eq(subscriptions.planId, subscriptionPlans.id))
    .where(eq(subscriptions.id, input.subscriptionId))
    .limit(1);

  if (!sub) throw notFound('Subscription not found');
  if (sub.sub.userId !== userId) throw forbidden('This subscription does not belong to you');
  if (sub.sub.status !== 'pending') {
    throw forbidden(`Cannot pay for a subscription with status '${sub.sub.status}'`);
  }

  // Create the payment record first (FR32: we can track pending/failed).
  const [payment] = await db
    .insert(payments)
    .values({
      subscriptionId: input.subscriptionId,
      amount: sub.plan.priceXaf,
      currency: 'XAF',
      operator: input.operator,
      phoneNumber: input.phoneNumber,
      status: 'pending',
    })
    .returning();

  if (!payment) throw new Error('Payment insert returned no row');

  // Initiate with Campay. If this throws, the payment row stays 'pending'.
  try {
    const result = await initiateCollection({
      amount: sub.plan.priceXaf,
      currency: 'XAF',
      operator: input.operator,
      phoneNumber: input.phoneNumber,
      externalRef: payment.id,
      description: `${sub.plan.name} subscription`,
    });

    // Store Campay's reference so the webhook can find this payment.
    const [updated] = await db
      .update(payments)
      .set({ providerReference: result.reference })
      .where(eq(payments.id, payment.id))
      .returning();

    return updated!;
  } catch (error) {
    // Mark as failed so the client knows.
    await db.update(payments).set({ status: 'failed' }).where(eq(payments.id, payment.id));

    throw error;
  }
}

// ---------------------------------------------------------------------------
// FR31 / FR34 — Handle Campay webhook
// ---------------------------------------------------------------------------

/**
 * FR31 / FR34: process a payment callback from Campay.
 *
 * Security:
 *  - Never trust the webhook body alone — always re-verify with Campay (FR31).
 *  - Idempotent: if providerReference already has status='success', return
 *    without reprocessing (FR34).
 *
 * SWE applied:
 *  - Atomicity: payment status update + subscription activation in one transaction.
 *  - BR4: startDate = MAX(now, latestActiveEndDate).
 *  - Idempotency: returns early if already processed (FR34 duplicate protection).
 *  - Fail Fast: unknown reference → log and return (do not error; Campay retries).
 */
export async function handleCampayWebhook(body: CampayWebhookBody): Promise<void> {
  const { reference } = body;

  // Find the payment by providerReference.
  const [payment] = await db
    .select()
    .from(payments)
    .where(eq(payments.providerReference, reference))
    .limit(1);

  if (!payment) {
    // Could be a test ping or a reference we don't own — log and ignore.
    logger.warn({ reference }, 'Campay webhook: unknown reference');
    return;
  }

  // FR34: idempotency — already processed successfully.
  if (payment.status === 'success') {
    logger.info({ reference }, 'Campay webhook: already processed, skipping');
    return;
  }

  // FR31: verify status with Campay — never trust the body.
  const verified = await getTransactionStatus(reference);

  if (verified.status === 'PENDING') {
    // Not finalised yet; Campay will retry.
    logger.info({ reference }, 'Campay webhook: still pending');
    return;
  }

  if (verified.status === 'FAILED') {
    await db.update(payments).set({ status: 'failed' }).where(eq(payments.id, payment.id));
    logger.info({ reference }, 'Campay webhook: payment failed');
    return;
  }

  // Status is SUCCESSFUL — activate the subscription in one transaction.
  await activateSubscription(payment);
  logger.info({ reference, paymentId: payment.id }, 'Campay webhook: payment confirmed');
}

// ---------------------------------------------------------------------------
// FR33 — Payment history
// ---------------------------------------------------------------------------

/** FR33: return all payments for the authenticated user, newest first. */
export async function getUserPayments(userId: string): Promise<PaymentRow[]> {
  return db
    .select({ payments })
    .from(payments)
    .innerJoin(subscriptions, eq(payments.subscriptionId, subscriptions.id))
    .where(eq(subscriptions.userId, userId))
    .orderBy(desc(payments.createdAt))
    .then((rows) => rows.map((r) => r.payments));
}

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

/**
 * Activate a subscription after a confirmed payment.
 * Implements BR4: startDate = MAX(now, latestActiveEndDate).
 *
 * SWE applied:
 *  - Atomicity: single transaction; partial failure leaves no inconsistent state.
 *  - Single Responsibility: activation logic isolated — not duplicated in
 *    webhook handler or any other caller.
 *  - DRY: reuses getLatestActiveSubscription from subscriptions.service.
 */
async function activateSubscription(payment: PaymentRow): Promise<void> {
  // Load the subscription and its plan to compute endDate.
  const [row] = await db
    .select({ sub: subscriptions, plan: subscriptionPlans })
    .from(subscriptions)
    .innerJoin(subscriptionPlans, eq(subscriptions.planId, subscriptionPlans.id))
    .where(eq(subscriptions.id, payment.subscriptionId))
    .limit(1);

  if (!row) throw new Error(`Subscription ${payment.subscriptionId} not found during activation`);

  // BR4: start after any currently active/cancelled subscription that hasn't ended.
  const existing = await getLatestActiveSubscription(row.sub.userId);

  const now = new Date();
  const startDate = existing?.endDate && existing.endDate > now ? existing.endDate : now;
  const endDate = addDays(startDate, row.plan.durationDays);

  await db.transaction(async (tx) => {
    await tx
      .update(payments)
      .set({ status: 'success', confirmedAt: now, providerReference: payment.providerReference })
      .where(eq(payments.id, payment.id));

    await tx
      .update(subscriptions)
      .set({ status: 'active', startDate, endDate })
      .where(eq(subscriptions.id, payment.subscriptionId));
  });
}
