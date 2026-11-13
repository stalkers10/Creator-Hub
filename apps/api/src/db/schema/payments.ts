import { integer, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { PAYMENT_OPERATORS, PAYMENT_STATUSES } from '@content-platform/shared';

import { subscriptions } from './subscriptions';

export const paymentStatus = pgEnum('payment_status', PAYMENT_STATUSES);
export const paymentOperator = pgEnum('payment_operator', PAYMENT_OPERATORS);

export const payments = pgTable('payments', {
  id: uuid('id').primaryKey().defaultRandom(),
  subscriptionId: uuid('subscription_id')
    .notNull()
    .references(() => subscriptions.id, { onDelete: 'cascade' }),
  amount: integer('amount').notNull(),
  currency: text('currency').notNull().default('XAF'),
  operator: paymentOperator('operator').notNull(),
  phoneNumber: text('phone_number').notNull(),
  /** Campay transaction reference. Unique: each transaction is processed only once (FR34). */
  providerReference: text('provider_reference').unique(),
  status: paymentStatus('status').notNull().default('pending'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  confirmedAt: timestamp('confirmed_at', { withTimezone: true }),
});

export type Payment = typeof payments.$inferSelect;
