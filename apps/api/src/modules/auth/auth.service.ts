import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import type { AuthResponse } from '@content-platform/shared';

import { db } from '../../db';
import { creatorProfiles, users } from '../../db/schema';
import { isUniqueViolation } from '../../lib/db-errors';
import { conflict, forbidden, unauthorized } from '../../lib/errors';
import { signToken } from '../../lib/jwt';
import { toPublicUser } from '../users/users.service';
import type { LoginInput, RegisterInput } from './auth.schemas';

const BCRYPT_ROUNDS = 12;

/** FR1 + FR6: create the account; the password is stored as a salted hash only. */
export async function register(input: RegisterInput): Promise<AuthResponse> {
  const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);

  try {
    const [created] = await db
      .insert(users)
      .values({ name: input.name, email: input.email, passwordHash })
      .returning();
    if (!created) throw new Error('Insert returned no row');

    return { token: signToken(created), user: toPublicUser(created, false) };
  } catch (error) {
    if (isUniqueViolation(error)) throw conflict('An account with this email already exists');
    throw error;
  }
}

/** FR2: check the credentials and return a token. */
export async function login(input: LoginInput): Promise<AuthResponse> {
  const rows = await db
    .select({ user: users, creatorId: creatorProfiles.id })
    .from(users)
    .leftJoin(creatorProfiles, eq(creatorProfiles.userId, users.id))
    .where(eq(users.email, input.email))
    .limit(1);

  const row = rows[0];
  // Same error for unknown email and wrong password: do not reveal which accounts exist.
  const valid = row ? await bcrypt.compare(input.password, row.user.passwordHash) : false;
  if (!row || !valid) throw unauthorized('Invalid email or password');
  if (row.user.status !== 'active') throw forbidden('This account is suspended');

  return { token: signToken(row.user), user: toPublicUser(row.user, row.creatorId !== null) };
}
