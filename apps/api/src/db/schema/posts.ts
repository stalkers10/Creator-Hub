import { index, integer, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { MEDIA_TYPES, MODERATION_STATUSES, POST_TYPES } from '@content-platform/shared';

import { creatorProfiles } from './users';

export const postType = pgEnum('post_type', POST_TYPES);
export const mediaType = pgEnum('media_type', MEDIA_TYPES);
export const moderationStatus = pgEnum('moderation_status', MODERATION_STATUSES);

export const posts = pgTable(
  'posts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    creatorId: uuid('creator_id')
      .notNull()
      .references(() => creatorProfiles.id, { onDelete: 'cascade' }),
    type: postType('type').notNull(),
    caption: text('caption'),
    textContent: text('text_content'),
    viewCount: integer('view_count').notNull().default(0),
    moderationStatus: moderationStatus('moderation_status').notNull().default('visible'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('posts_created_at_idx').on(t.createdAt),
    index('posts_creator_idx').on(t.creatorId),
  ],
);

/** Only the Cloudinary identifier and URL are stored here; the file lives in Cloudinary. */
export const mediaAssets = pgTable('media_assets', {
  id: uuid('id').primaryKey().defaultRandom(),
  postId: uuid('post_id')
    .notNull()
    .references(() => posts.id, { onDelete: 'cascade' }),
  cloudinaryPublicId: text('cloudinary_public_id').notNull(),
  url: text('url').notNull(),
  mediaType: mediaType('media_type').notNull(),
  duration: integer('duration_seconds'),
  width: integer('width'),
  height: integer('height'),
});

export type Post = typeof posts.$inferSelect;
export type NewPost = typeof posts.$inferInsert;
export type MediaAsset = typeof mediaAssets.$inferSelect;
