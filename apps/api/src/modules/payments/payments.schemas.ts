import { z } from 'zod';

/**
 * FR30: initiate a payment for a pending subscription.
 */
export const initiatePaymentSchema = z.object({
  subscriptionId: z.string().uuid('subscriptionId must be a valid UUID'),
  operator: z.enum(['mtn', 'orange']),
  phoneNumber: z.string().regex(/^\+?[0-9]{9,15}$/, 'phoneNumber must be a valid mobile number'),
});

/**
 * FR31: Campay webhook payload.
 * We only trust the reference — everything else is re-verified with Campay.
 */
export const campayWebhookSchema = z.object({
  reference: z.string().min(1),
  status: z.string().optional(), // present but we re-verify — do not trust
  amount: z.union([z.string(), z.number()]).optional(),
  currency: z.string().optional(),
  signature: z.string().min(1),
  external_reference: z.string().optional(),
});

export type InitiatePaymentInput = z.infer<typeof initiatePaymentSchema>;
export type CampayWebhookBody = z.infer<typeof campayWebhookSchema>;
