import { z } from 'zod';

const mediaAssetSchema = z.object({
  cloudinaryPublicId: z.string().min(1),
  url: z.string().url(),
  mediaType: z.enum(['image', 'video']),
  /** Duration in seconds — required for videos. */
  duration: z.number().int().positive().optional(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
});

/**
 * FR8 — Publish a post.
 *
 * Cross-field rules (SWE: Open/Closed via superRefine — type-specific rules
 * are added without touching the base object schema):
 *  - text posts must have textContent
 *  - video/image posts must have at least one media asset
 *  - text posts must NOT carry media assets
 */
export const createPostSchema = z
  .object({
    type: z.enum(['video', 'image', 'text']),
    caption: z.string().trim().max(2000).optional(),
    textContent: z.string().trim().min(1).max(10000).optional(),
    mediaAssets: z.array(mediaAssetSchema).max(10).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.type === 'text' && !data.textContent) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'textContent is required for text posts',
        path: ['textContent'],
      });
    }
    if ((data.type === 'video' || data.type === 'image') && !data.mediaAssets?.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'mediaAssets is required for video and image posts',
        path: ['mediaAssets'],
      });
    }
    if (data.type === 'text' && data.mediaAssets?.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'text posts cannot have media assets',
        path: ['mediaAssets'],
      });
    }
  });

/** FR9 — Edit a post: only caption and textContent are mutable after publication. */
export const updatePostSchema = z
  .object({
    caption: z.string().trim().max(2000).optional(),
    textContent: z.string().trim().min(1).max(10000).optional(),
  })
  .refine((d) => d.caption !== undefined || d.textContent !== undefined, {
    message: 'At least one of caption or textContent must be provided',
  });

export const postIdParamsSchema = z.object({
  id: z.string().uuid('Post id must be a valid UUID'),
});

export type CreatePostInput = z.infer<typeof createPostSchema>;
export type UpdatePostInput = z.infer<typeof updatePostSchema>;
