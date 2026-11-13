import { eq } from 'drizzle-orm';
import type { PublicUser } from '@content-platform/shared';

import { db } from '../../db';
import { creatorProfiles, users, type User } from '../../db/schema';
import { notFound } from '../../lib/errors';

export function toPublicUser(user: User, isCreator: boolean): PublicUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    isCreator,
    isAdmin: user.isAdmin,
  };
}

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
