import { eq } from 'drizzle-orm';
import type { PublicUser } from '@content-platform/shared';

import { db } from '../../db';
import { creatorProfiles, users, type User } from '../../db/schema';
import { isUniqueViolation } from '../../lib/db-errors';
import { conflict, notFound } from '../../lib/errors';
import type { CreatorModeInput, UpdateProfileInput } from './users.schemas';

// ---------------------------------------------------------------------------
// Shared mapper — Single Responsibility + DRY
// ---------------------------------------------------------------------------

/** Maps a DB user row to the public shape exposed by the API. Never returns passwordHash. */
export function toPublicUser(user: User, isCreator: boolean): PublicUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    isCreator,
    isAdmin: user.isAdmin,
  };
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/** FR1/FR2/FR3: fetch a user with their creator status by id. */
export async function getPublicUserById(id: string): Promise<PublicUser> {
  const rows = await db
    .select({ user: users, creatorId: creatorProfiles.id })
    .from(users)
    .leftJoin(creatorProfiles, eq(creatorProfiles.userId, users.id))
    .where(eq(users.id, id))
    .limit(1);

  const row = rows[0];
  if (!row) throw notFound('User not found');
  return toPublicUser(row.user, row.creatorId !== null);
}

// ---------------------------------------------------------------------------
// FR3 — update profile
// ---------------------------------------------------------------------------

/**
 * FR3: update the authenticated user's name and/or email.
 *
 * SWE applied:
 *  - Fail fast: unique-constraint violation is caught immediately and
 *    re-thrown as a typed 409 (no silent data corruption).
 *  - Single Responsibility: only mutates profile fields — password
 *    changes live in auth.service.ts (FR4).
 *  - DRY: reuses toPublicUser and getPublicUserById instead of
 *    duplicating the select logic.
 */
export async function updateProfile(userId: string, input: UpdateProfileInput): Promise<PublicUser> {
  // Build the patch object from only the fields the caller provided (partial update).
  const patch: Partial<Pick<User, 'name' | 'email'>> = {};
  if (input.name !== undefined) patch.name = input.name;
  if (input.email !== undefined) patch.email = input.email;

  try {
    const updated = await db
      .update(users)
      .set(patch)
      .where(eq(users.id, userId))
      .returning();

    if (!updated[0]) throw notFound('User not found');
  } catch (error) {
    if (isUniqueViolation(error)) throw conflict('This email is already in use');
    throw error;
  }

  // Re-query to pick up the creator status (not held in the users row).
  return getPublicUserById(userId);
}

// ---------------------------------------------------------------------------
// FR5 — creator mode toggle
// ---------------------------------------------------------------------------

/**
 * FR5: enable or disable creator mode for the authenticated user.
 *
 * Enable  → inserts a creator_profiles row if one does not exist yet.
 *           Throws 409 if the user is already a creator (idempotency guard).
 * Disable → deletes the creator_profiles row.
 *           Throws 404 if the user was not a creator (no-op is not silently ignored
 *           so the client knows its local state was already out of sync).
 *
 * SWE applied:
 *  - Command–Query Separation: this function is a command (write). The
 *    controller calls getPublicUserById afterwards to build the response.
 *  - Defensive programming: both branches guard against the impossible
 *    state (enable when already creator / disable when not creator).
 *  - Open/Closed: creator profile creation is fully isolated here;
 *    other modules that need isCreator still call getPublicUserById.
 */
export async function setCreatorMode(userId: string, input: CreatorModeInput): Promise<PublicUser> {
  if (input.enable) {
    // Guard: reject if the user already has a creator profile.
    const existing = await db
      .select({ id: creatorProfiles.id })
      .from(creatorProfiles)
      .where(eq(creatorProfiles.userId, userId))
      .limit(1);

    if (existing[0]) throw conflict('Creator mode is already enabled');

    // displayName is guaranteed by the Zod schema when enable === true.
    await db.insert(creatorProfiles).values({
      userId,
      displayName: input.displayName!,
      bio: input.bio ?? null,
    });
  } else {
    // Guard: nothing to disable if no profile exists.
    const deleted = await db
      .delete(creatorProfiles)
      .where(eq(creatorProfiles.userId, userId))
      .returning({ id: creatorProfiles.id });

    if (!deleted[0]) throw notFound('Creator mode is not enabled on this account');
  }

  // Return the refreshed public user so the client gets the updated isCreator flag.
  return getPublicUserById(userId);
}
