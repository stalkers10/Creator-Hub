import bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'crypto';
import { and, eq, gt, isNull } from 'drizzle-orm';
import type { AuthResponse } from '@content-platform/shared';

import { db } from '../../db';
import { creatorProfiles, passwordResetTokens, users } from '../../db/schema';
import { isUniqueViolation } from '../../lib/db-errors';
import { badRequest, conflict, forbidden, unauthorized } from '../../lib/errors';
import { signToken } from '../../lib/jwt';
import { sendMail } from '../../lib/mailer';
import { env } from '../../config/env';
import { toPublicUser } from '../users/users.service';
import type { ForgotPasswordInput, LoginInput, RegisterInput, ResetPasswordInput } from './auth.schemas';

const BCRYPT_ROUNDS = 12;
/** Reset tokens expire after one hour. */
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;

/** Returns the SHA-256 hex digest of a raw token string. Never store the raw token. */
function hashToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

// ---------------------------------------------------------------------------
// FR1 + FR6: Register
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// FR2: Login
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// FR4: Password reset — request
// ---------------------------------------------------------------------------

/**
 * FR4: generate a single-use reset token, persist its hash, and email the link.
 *
 * Always returns void regardless of whether the email exists, to prevent
 * email enumeration (an attacker cannot tell whether an account is registered).
 */
export async function requestPasswordReset(input: ForgotPasswordInput): Promise<void> {
  const [user] = await db
    .select({ id: users.id, email: users.email, name: users.name })
    .from(users)
    .where(eq(users.email, input.email))
    .limit(1);

  // No user with that email: return silently (no enumeration).
  if (!user) return;

  // 32 random bytes → 64-char hex string → 256 bits of entropy.
  const rawToken = randomBytes(32).toString('hex');
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);

  await db.insert(passwordResetTokens).values({
    userId: user.id,
    tokenHash,
    expiresAt,
  });

  const resetLink = `${env.APP_RESET_URL}?token=${rawToken}`;

  await sendMail({
    to: user.email,
    subject: 'Reset your password',
    text: [
      `Hi ${user.name},`,
      '',
      'You requested a password reset. Use the link below — it expires in 1 hour.',
      '',
      resetLink,
      '',
      'If you did not request this, you can ignore this email.',
    ].join('\n'),
    html: `
      <p>Hi ${user.name},</p>
      <p>You requested a password reset. Click the link below — it expires in <strong>1 hour</strong>.</p>
      <p><a href="${resetLink}">Reset my password</a></p>
      <p>If you did not request this, you can ignore this email.</p>
    `,
  });
}

// ---------------------------------------------------------------------------
// FR4: Password reset — confirm
// ---------------------------------------------------------------------------

/**
 * FR4: validate the token, update the password, and invalidate the token.
 * Uses a single DB transaction so the token cannot be replayed on failure.
 */
export async function resetPassword(input: ResetPasswordInput): Promise<void> {
  const tokenHash = hashToken(input.token);
  const now = new Date();

  const [record] = await db
    .select()
    .from(passwordResetTokens)
    .where(
      and(
        eq(passwordResetTokens.tokenHash, tokenHash),
        gt(passwordResetTokens.expiresAt, now),
        isNull(passwordResetTokens.usedAt),
      ),
    )
    .limit(1);

  if (!record) throw badRequest('This reset link is invalid or has expired');

  const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);

  await db.transaction(async (tx) => {
    // Mark the token as used first to prevent concurrent reuse.
    await tx
      .update(passwordResetTokens)
      .set({ usedAt: now })
      .where(eq(passwordResetTokens.id, record.id));

    await tx
      .update(users)
      .set({ passwordHash })
      .where(eq(users.id, record.userId));
  });
}
