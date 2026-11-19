import { z } from 'zod';

/**
 * FR3 — update own profile.
 * At least one field must be provided (enforced by .refine below).
 * Email goes through the same normalisation as registration.
 */
export const updateProfileSchema = z
  .object({
    name: z.string().trim().min(1).max(80).optional(),
    email: z.string().trim().toLowerCase().email().max(254).optional(),
  })
  .refine((data) => data.name !== undefined || data.email !== undefined, {
    message: 'At least one of name or email must be provided',
  });

/**
 * FR5 — toggle creator mode on / off.
 * When enabling (enable: true), displayName is required.
 * When disabling (enable: false), displayName is ignored.
 */
export const creatorModeSchema = z
  .object({
    enable: z.boolean(),
    displayName: z.string().trim().min(1).max(80).optional(),
    bio: z.string().trim().max(500).optional(),
  })
  .refine((data) => !data.enable || data.displayName !== undefined, {
    message: 'displayName is required when enabling creator mode',
    path: ['displayName'],
  });

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type CreatorModeInput = z.infer<typeof creatorModeSchema>;
