import { z } from 'zod';

export const creatorIdParamsSchema = z.object({
  id: z.string().uuid('Creator id must be a valid UUID'),
});

export const postIdParamsSchema = z.object({
  id: z.string().uuid('Post id must be a valid UUID'),
});
