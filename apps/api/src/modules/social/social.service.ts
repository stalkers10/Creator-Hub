import { and, eq } from 'drizzle-orm';

import { db } from '../../db';
import { creatorProfiles, follows } from '../../db/schema';
import { notFound } from '../../lib/errors';

// ---------------------------------------------------------------------------
// FR11 — Follow / unfollow toggle
// ---------------------------------------------------------------------------

/**
 * FR11: toggle the follow relationship between a user and a creator.
 * Returns the new state so the client can update its UI without a second request.
 *
 * SWE applied:
 *  - Command–Query Separation: this function both writes and returns the new
 *    state. The return value is minimal (just { following }), not a full
 *    re-read of the creator, keeping the response lightweight.
 *  - Fail Fast: confirms the creator exists before any write.
 *  - Idempotency: following an already-followed creator un-follows;
 *    the caller gets a consistent result regardless of the starting state.
 */
export async function toggleFollow(
  followerId: string,
  creatorId: string,
): Promise<{ following: boolean }> {
  // Verify the creator exists.
  const [creator] = await db
    .select({ id: creatorProfiles.id })
    .from(creatorProfiles)
    .where(eq(creatorProfiles.id, creatorId))
    .limit(1);

  if (!creator) throw notFound('Creator not found');

  // Check whether the follow row already exists.
  const [existing] = await db
    .select({ followerId: follows.followerId })
    .from(follows)
    .where(and(eq(follows.followerId, followerId), eq(follows.creatorId, creatorId)))
    .limit(1);

  if (existing) {
    await db
      .delete(follows)
      .where(and(eq(follows.followerId, followerId), eq(follows.creatorId, creatorId)));
    return { following: false };
  }

  await db.insert(follows).values({ followerId, creatorId });
  return { following: true };
}
