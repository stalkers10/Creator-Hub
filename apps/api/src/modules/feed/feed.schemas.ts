import { z } from 'zod';

/**
 * FR13 — Feed query params.
 * Cursor is an ISO date string of the oldest post seen (for keyset pagination).
 */
export const feedQuerySchema = z.object({
  cursor: z.string().datetime({ offset: true }).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export type FeedQuery = z.infer<typeof feedQuerySchema>;
