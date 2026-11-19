import { eq, sql } from 'drizzle-orm';

import { db } from '../../db';
import { creatorProfiles, mediaAssets, posts } from '../../db/schema';
import { forbidden, notFound, unauthorized } from '../../lib/errors';
import type { CreatePostInput, UpdatePostInput } from './posts.schemas';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PostWithMedia {
  id: string;
  type: string;
  caption: string | null;
  textContent: string | null;
  viewCount: number;
  moderationStatus: string;
  createdAt: string;
  creator: {
    id: string;
    displayName: string;
    profilePicture: string | null;
  };
  media: Array<{
    id: string;
    url: string;
    mediaType: string;
    duration: number | null;
    width: number | null;
    height: number | null;
  }>;
}

// ---------------------------------------------------------------------------
// FR8 — Publish a post
// ---------------------------------------------------------------------------

/**
 * FR8: create a post and its media assets in one transaction.
 *
 * SWE applied:
 *  - Fail Fast: creator ownership is verified before any insert.
 *  - Layer Isolation: no req/res here; service only knows about domain types.
 *  - Atomicity: post row and all media rows are inserted in a single DB
 *    transaction; a partial failure leaves no orphan records.
 */
export async function createPost(userId: string, input: CreatePostInput): Promise<PostWithMedia> {
  // Verify the user has an active creator profile (BR6 prerequisite).
  const [creator] = await db
    .select({
      id: creatorProfiles.id,
      displayName: creatorProfiles.displayName,
      profilePicture: creatorProfiles.profilePicture,
    })
    .from(creatorProfiles)
    .where(eq(creatorProfiles.userId, userId))
    .limit(1);

  if (!creator) throw unauthorized('You must enable creator mode before publishing posts');

  const post = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(posts)
      .values({
        creatorId: creator.id,
        type: input.type,
        caption: input.caption ?? null,
        textContent: input.textContent ?? null,
      })
      .returning();

    if (!created) throw new Error('Post insert returned no row');

    const assets = input.mediaAssets?.length
      ? await tx
          .insert(mediaAssets)
          .values(
            input.mediaAssets.map((a) => ({
              postId: created.id,
              cloudinaryPublicId: a.cloudinaryPublicId,
              url: a.url,
              mediaType: a.mediaType,
              duration: a.duration ?? null,
              width: a.width ?? null,
              height: a.height ?? null,
            })),
          )
          .returning()
      : [];

    return { post: created, assets };
  });

  return toPostWithMedia(post.post, post.assets, creator);
}

// ---------------------------------------------------------------------------
// Get one post
// ---------------------------------------------------------------------------

export async function getPostById(postId: string): Promise<PostWithMedia> {
  const [row] = await db
    .select({ post: posts, creator: creatorProfiles })
    .from(posts)
    .innerJoin(creatorProfiles, eq(posts.creatorId, creatorProfiles.id))
    .where(eq(posts.id, postId))
    .limit(1);

  if (!row) throw notFound('Post not found');
  if (row.post.moderationStatus === 'removed') throw notFound('Post not found');

  // Increment view count asynchronously — fire and forget (non-critical path).
  db.update(posts)
    .set({ viewCount: sql`${posts.viewCount} + 1` })
    .where(eq(posts.id, postId))
    .catch(() => {
      /* ignore */
    });

  const assets = await db.select().from(mediaAssets).where(eq(mediaAssets.postId, postId));

  return toPostWithMedia(row.post, assets, row.creator);
}

// ---------------------------------------------------------------------------
// FR9 — Edit own post
// ---------------------------------------------------------------------------

/**
 * FR9 / BR6: only the post owner can edit.
 *
 * SWE applied:
 *  - Fail Fast: ownership is verified before any write.
 *  - Defensive Programming: responds 403, not 404, when the post exists
 *    but the caller doesn't own it (prevents enumeration of other users' posts
 *    if we returned 404 for "not found AND not owned").
 */
export async function updatePost(
  postId: string,
  userId: string,
  input: UpdatePostInput,
): Promise<PostWithMedia> {
  const [row] = await db
    .select({ post: posts, creator: creatorProfiles })
    .from(posts)
    .innerJoin(creatorProfiles, eq(posts.creatorId, creatorProfiles.id))
    .where(eq(posts.id, postId))
    .limit(1);

  if (!row) throw notFound('Post not found');
  assertOwner(row.creator, userId);

  const patch: Partial<typeof posts.$inferInsert> = {};
  if (input.caption !== undefined) patch.caption = input.caption;
  if (input.textContent !== undefined) patch.textContent = input.textContent;

  await db.update(posts).set(patch).where(eq(posts.id, postId));

  const assets = await db.select().from(mediaAssets).where(eq(mediaAssets.postId, postId));
  return toPostWithMedia({ ...row.post, ...patch }, assets, row.creator);
}

// ---------------------------------------------------------------------------
// FR9 — Delete own post
// ---------------------------------------------------------------------------

export async function deletePost(postId: string, userId: string): Promise<void> {
  const [row] = await db
    .select({ creator: creatorProfiles })
    .from(posts)
    .innerJoin(creatorProfiles, eq(posts.creatorId, creatorProfiles.id))
    .where(eq(posts.id, postId))
    .limit(1);

  if (!row) throw notFound('Post not found');
  assertOwner(row.creator, userId);

  await db.delete(posts).where(eq(posts.id, postId));
}

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

/** BR6: throws 403 when the calling user does not own the creator profile. */
function assertOwner(creator: { userId: string }, userId: string): void {
  if (creator.userId !== userId) {
    throw forbidden('You can only edit or delete your own posts');
  }
}

function toPostWithMedia(
  post: typeof posts.$inferSelect,
  assets: (typeof mediaAssets.$inferSelect)[],
  creator: { id: string; displayName: string; profilePicture: string | null },
): PostWithMedia {
  return {
    id: post.id,
    type: post.type,
    caption: post.caption,
    textContent: post.textContent,
    viewCount: post.viewCount,
    moderationStatus: post.moderationStatus,
    createdAt: post.createdAt.toISOString(),
    creator: {
      id: creator.id,
      displayName: creator.displayName,
      profilePicture: creator.profilePicture,
    },
    media: assets.map((a) => ({
      id: a.id,
      url: a.url,
      mediaType: a.mediaType,
      duration: a.duration,
      width: a.width,
      height: a.height,
    })),
  };
}
