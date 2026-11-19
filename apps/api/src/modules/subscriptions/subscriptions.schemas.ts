import { z } from 'zod';

/** FR23: create a pending subscription by selecting a plan. */
export const createSubscriptionSchema = z.object({
  planId: z.string().uuid('planId must be a valid UUID'),
});

/** Params for subscription-specific routes. */
export const subscriptionIdParamsSchema = z.object({
  id: z.string().uuid('Subscription id must be a valid UUID'),
});

export type CreateSubscriptionInput = z.infer<typeof createSubscriptionSchema>;
