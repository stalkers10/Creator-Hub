import { count, eq, ilike, or, sql } from 'drizzle-orm';

import { db } from '../../db';
import { comments, creatorProfiles, follows, likes, posts, users } from '../../db/schema';
import { forbidden, notFound } from '../../lib/errors';
import type { ListCreatorsQuery, UpdateCreatorProfileInput } from './creators.schemas';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CreatorSummary {
  id: string;
  displayName: string;
  bio: string | null;
  profilePicture: string | null;
  followerCount: number;
  postCount: number;
}

export interface CreatorDetail extends CreatorSummary {
  userId: string;
}

export interface CreatorDashboard extends CreatorDetail {
  totalViews: number;
  totalLikes: number;
  totalComments: number;
}

// ---------------------------------------------------------------------------
// FR7 — Update own creator profile
// ---------------------------------------------------------------------------

/**
 * FR7: update the authenticated user's creator profile fields.
 *
 * SWE applied:
 *  - Fail Fast: verifies creator existence before the update attempt.
 *  - Defensive Programming: ownership is enforced — only the owner can update.
 *  - Single Responsibility: profile update logic is isolated here.
 */
export async function updateCreatorProfile(
  userId: string,
  input: UpdateCreatorProfileInput,
): Promise<CreatorDetail> {
  const [existing] = await db
    .select({ id: creatorProfiles.id })
    .from(creatorProfiles)
    .where(eq(creatorProfiles.userId, userId))
    .limit(1);

  if (!existing) throw forbidden('Creator mode is not enabled on this account');

  const patch: Partial<typeof creatorProfiles.$inferInsert> = {};
  if (input.displayName !== undefined) patch.displayName = input.displayName;
  if (input.bio !== undefined) patch.bio = input.bio;
  if (input.profilePicture !== undefined) patch.profilePicture = input.profilePicture;

  await db.update(creatorProfiles).set(patch).where(eq(creatorProfiles.id, existing.id));

  return getCreatorById(existing.id);
}

// ---------------------------------------------------------------------------
// FR10 — List and search creators
// ---------------------------------------------------------------------------

/**
 * FR10: return a paginated list of creators, optionally filtered by search text.
 *
 * SWE applied:
 *  - DRY: pagination query pattern shared with other list endpoints.
 *  - Input Validation at the boundary: pagination params are coerced
 *    and bounded in the Zod schema before reaching this function.
 *  - CQS: count and rows run in parallel (independent reads, no side effects).
 */
export async function listCreators(query: ListCreatorsQuery): Promise<{
  creators: CreatorSummary[];
  total: number;
}> {
  const searchFilter = query.search
    ? or(
        ilike(creatorProfiles.displayName, `%${query.search}%`),
        ilike(creatorProfiles.bio ?? '', `%${query.search}%`),
      )
    : undefined;

  const [countResult, rows] = await Promise.all([
    db.select({ value: count() }).from(creatorProfiles).where(searchFilter),

    db
      .select({
        profile: creatorProfiles,
        followerCount: sql<number>`cast(count(distinct ${follows.followerId}) as int)`,
        postCount: sql<number>`cast(count(distinct ${posts.id}) as int)`,
      })
      .from(creatorProfiles)
      .leftJoin(follows, eq(follows.creatorId, creatorProfiles.id))
      .leftJoin(posts, eq(posts.creatorId, creatorProfiles.id))
      .where(searchFilter)
      .groupBy(creatorProfiles.id)
      .limit(query.limit)
      .offset(query.offset),
  ]);

  return {
    creators: rows.map((r) => toCreatorSummary(r.profile, r.followerCount, r.postCount)),
    total: countResult[0]?.value ?? 0,
  };
}

// ---------------------------------------------------------------------------
// FR10 — Get one creator (public profile)
// ---------------------------------------------------------------------------

export async function getCreatorById(creatorId: string): Promise<CreatorDetail> {
  const [row] = await db
    .select({
      profile: creatorProfiles,
      userId: users.id,
      followerCount: sql<number>`cast(count(distinct ${follows.followerId}) as int)`,
      postCount: sql<number>`cast(count(distinct ${posts.id}) as int)`,
    })
    .from(creatorProfiles)
    .innerJoin(users, eq(users.id, creatorProfiles.userId))
    .leftJoin(follows, eq(follows.creatorId, creatorProfiles.id))
    .leftJoin(posts, eq(posts.creatorId, creatorProfiles.id))
    .where(eq(creatorProfiles.id, creatorId))
    .groupBy(creatorProfiles.id, users.id)
    .limit(1);

  if (!row) throw notFound('Creator not found');

  return { ...toCreatorSummary(row.profile, row.followerCount, row.postCount), userId: row.userId };
}

// ---------------------------------------------------------------------------
// FR12 — Creator dashboard (owner only)
// ---------------------------------------------------------------------------

/**
 * FR12: aggregate stats for the creator's own dashboard.
 *
 * SWE applied:
 *  - Single Responsibility: stats aggregation is isolated from the public
 *    profile read — different concern, different function.
 *  - Command–Query Separation: pure read; no side effects.
 *  - DRY: reuses getCreatorById for the shared profile fields.
 *  - Principle of Least Privilege: dashboard data is gated behind
 *    ownership check; non-owners receive a 403.
 */
export async function getCreatorDashboard(
  creatorId: string,
  requestingUserId: string,
): Promise<CreatorDashboard> {
  const profile = await getCreatorById(creatorId);

  if (profile.userId !== requestingUserId) {
    throw forbidden('You can only view your own creator dashboard');
  }

  const [viewsAndLikes] = await db
    .select({
      totalViews: sql<number>`coalesce(cast(sum(${posts.viewCount}) as int), 0)`,
      totalLikes: sql<number>`cast(count(distinct ${likes.userId}) as int)`,
    })
    .from(posts)
    .leftJoin(likes, eq(likes.postId, posts.id))
    .where(eq(posts.creatorId, creatorId));

  const [commentRow] = await db
    .select({ totalComments: sql<number>`cast(count(*) as int)` })
    .from(comments)
    .innerJoin(posts, eq(comments.postId, posts.id))
    .where(eq(posts.creatorId, creatorId));

  return {
    ...profile,
    totalViews: viewsAndLikes?.totalViews ?? 0,
    totalLikes: viewsAndLikes?.totalLikes ?? 0,
    totalComments: commentRow?.totalComments ?? 0,
  };
}

// ---------------------------------------------------------------------------
// Private helpers — DRY mapper
// ---------------------------------------------------------------------------

function toCreatorSummary(
  profile: typeof creatorProfiles.$inferSelect,
  followerCount: number,
  postCount: number,
): CreatorSummary {
  return {
    id: profile.id,
    displayName: profile.displayName,
    bio: profile.bio,
    profilePicture: profile.profilePicture,
    followerCount,
    postCount,
  };
}
