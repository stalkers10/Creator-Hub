import { and, desc, eq, inArray, lt } from 'drizzle-orm';

import { db } from '../../db';
import { creatorProfiles, follows, mediaAssets, posts } from '../../db/schema';
import type { QuotaStatus } from '../usage/usage.service';
import type { FeedQuery } from './feed.schemas';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FeedMediaAsset {
  url: string;
  mediaType: string;
  duration: number | null;
}

export interface FeedPost {
  id: string;
  type: string;
  caption: string | null;
  textContent: string | null;
  viewCount: number;
  createdAt: string;
  creator: {
    id: string;
    displayName: string;
    profilePicture: string | null;
  };
  media: FeedMediaAsset[];
}

export interface FeedResponse {
  posts: FeedPost[];
  nextCursor: string | null;
  quota: QuotaStatus;
}

// Explicit column selection — Drizzle does not support table-spread in select().
const postFields = {
  id: posts.id,
  type: posts.type,
  caption: posts.caption,
  textContent: posts.textContent,
  viewCount: posts.viewCount,
  moderationStatus: posts.moderationStatus,
  createdAt: posts.createdAt,
  creatorId: posts.creatorId,
  creatorDisplayName: creatorProfiles.displayName,
  creatorProfilePicture: creatorProfiles.profilePicture,
};

type PostRow = {
  id: string;
  type: 'video' | 'image' | 'text';
  caption: string | null;
  textContent: string | null;
  viewCount: number;
  moderationStatus: string;
  createdAt: Date;
  creatorId: string;
  creatorDisplayName: string;
  creatorProfilePicture: string | null;
};

// ---------------------------------------------------------------------------
// FR13 — Feed
// ---------------------------------------------------------------------------

/**
 * FR13: return a page of visible posts.
 *
 * Strategy (spec section 5.3):
 *  - Logged-in users see posts from followed creators prioritised first,
 *    then filled with recent platform-wide posts up to the page limit.
 *  - Visitors see a simple recency feed.
 *  - Only posts with moderationStatus = 'visible' are shown.
 *  - Keyset pagination on createdAt (cursor = ISO string of oldest seen post).
 *
 * SWE applied:
 *  - Single Responsibility: assembles the feed; quota is passed in already
 *    computed by quotaGuard.
 *  - Command–Query Separation: pure read, no side effects.
 *  - N+1 prevention: media assets fetched in one batched query using inArray,
 *    then grouped in memory — no per-post query.
 *  - Open/Closed: follow-blend is an additive step; the base visitor query
 *    is unchanged.
 */
export async function getFeed(
  query: FeedQuery,
  userId: string | undefined,
  quota: QuotaStatus,
): Promise<FeedResponse> {
  const cursorDate = query.cursor ? new Date(query.cursor) : undefined;
  const fetchLimit = query.limit + 1; // fetch one extra to detect next page

  const baseConditions = [
    eq(posts.moderationStatus, 'visible'),
    ...(cursorDate ? [lt(posts.createdAt, cursorDate)] : []),
  ];

  let page: PostRow[];

  if (userId) {
    // For members: fetch followed-creator posts first, then pad with recent posts.
    const followedRows = await db
      .select({ creatorId: follows.creatorId })
      .from(follows)
      .where(eq(follows.followerId, userId));

    const followedIds = followedRows.map((r) => r.creatorId);

    if (followedIds.length > 0) {
      // Followed posts (highest priority).
      const followedPosts = await db
        .select(postFields)
        .from(posts)
        .innerJoin(creatorProfiles, eq(posts.creatorId, creatorProfiles.id))
        .where(and(...baseConditions, inArray(posts.creatorId, followedIds)))
        .orderBy(desc(posts.createdAt))
        .limit(fetchLimit);

      // If we got enough from followed creators, return early.
      if (followedPosts.length >= fetchLimit) {
        page = followedPosts.slice(0, query.limit) as PostRow[];
        const nextCursor =
          followedPosts.length > query.limit
            ? followedPosts[query.limit - 1]!.createdAt.toISOString()
            : null;
        return buildResponse(page, nextCursor, quota);
      }

      // Otherwise pad with recent non-followed posts.
      const seen = new Set(followedPosts.map((p) => p.id));
      const need = fetchLimit - followedPosts.length;

      const otherPosts = await db
        .select(postFields)
        .from(posts)
        .innerJoin(creatorProfiles, eq(posts.creatorId, creatorProfiles.id))
        .where(and(...baseConditions))
        .orderBy(desc(posts.createdAt))
        .limit(need + seen.size); // over-fetch to cover duplicates

      const deduped = (otherPosts as PostRow[]).filter((p) => !seen.has(p.id));
      const merged = [...(followedPosts as PostRow[]), ...deduped].slice(0, fetchLimit);

      const hasMore = merged.length > query.limit;
      page = merged.slice(0, query.limit);
      const nextCursor = hasMore ? page[page.length - 1]!.createdAt.toISOString() : null;
      return buildResponse(page, nextCursor, quota);
    }
    // No followed creators — fall through to visitor path.
  }

  // Visitor path: simple recency.
  const rows = (await db
    .select(postFields)
    .from(posts)
    .innerJoin(creatorProfiles, eq(posts.creatorId, creatorProfiles.id))
    .where(and(...baseConditions))
    .orderBy(desc(posts.createdAt))
    .limit(fetchLimit)) as PostRow[];

  const hasMore = rows.length > query.limit;
  page = rows.slice(0, query.limit);
  const nextCursor = hasMore ? page[page.length - 1]!.createdAt.toISOString() : null;
  return buildResponse(page, nextCursor, quota);
}

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

async function buildResponse(
  page: PostRow[],
  nextCursor: string | null,
  quota: QuotaStatus,
): Promise<FeedResponse> {
  const postIds = page.map((p) => p.id);

  // Batch-fetch all media assets for this page — DRY, N+1 safe.
  const assets =
    postIds.length > 0
      ? await db.select().from(mediaAssets).where(inArray(mediaAssets.postId, postIds))
      : [];

  // Group assets by postId in one pass — O(n).
  const assetsByPost = new Map<string, (typeof mediaAssets.$inferSelect)[]>();
  for (const asset of assets) {
    const list = assetsByPost.get(asset.postId) ?? [];
    list.push(asset);
    assetsByPost.set(asset.postId, list);
  }

  const feedPosts: FeedPost[] = page.map((row) => ({
    id: row.id,
    type: row.type,
    caption: row.caption,
    textContent: row.textContent,
    viewCount: row.viewCount,
    createdAt: row.createdAt.toISOString(),
    creator: {
      id: row.creatorId,
      displayName: row.creatorDisplayName,
      profilePicture: row.creatorProfilePicture,
    },
    media: (assetsByPost.get(row.id) ?? []).map((a) => ({
      url: a.url,
      mediaType: a.mediaType,
      duration: a.duration,
    })),
  }));

  return { posts: feedPosts, nextCursor, quota };
}
