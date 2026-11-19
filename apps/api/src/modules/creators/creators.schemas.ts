import { z } from 'zod';

/**
 * FR7 — Update own creator profile.
 * At least one field must be provided.
 */
export const updateCreatorProfileSchema = z
  .object({
    displayName: z.string().trim().min(1).max(80).optional(),
    bio: z.string().trim().max(500).optional(),
    profilePicture: z.string().url('profilePicture must be a valid URL').optional(),
  })
  .refine(
    (d) => d.displayName !== undefined || d.bio !== undefined || d.profilePicture !== undefined,
    { message: 'At least one field must be provided' },
  );

/** FR10 — Query params for creator search. */
export const listCreatorsQuerySchema = z.object({
  search: z.string().trim().max(100).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export const creatorIdParamsSchema = z.object({
  id: z.string().uuid('Creator id must be a valid UUID'),
});

export type UpdateCreatorProfileInput = z.infer<typeof updateCreatorProfileSchema>;
export type ListCreatorsQuery = z.infer<typeof listCreatorsQuerySchema>;
