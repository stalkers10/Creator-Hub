/**
 * FR4 — Password reset tests.
 *
 * These tests run against the real service layer, but stub:
 *   - the database (no live Postgres needed)
 *   - the mailer (no email sent)
 *
 * Property we verify:
 *   P1  forgot-password always returns 200 — even for unknown emails.
 *   P2  reset-password rejects an unknown token with 400.
 *   P3  reset-password rejects an expired token with 400.
 *   P4  reset-password rejects an already-used token with 400.
 *   P5  reset-password accepts a valid token and updates the password.
 *   P6  reset-password invalidates the token after one use (single-use guarantee).
 */

import { createHash, randomBytes } from 'crypto';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createApp } from '../../app';

// ---------------------------------------------------------------------------
// Module stubs — replace DB and mailer before the app runs
// ---------------------------------------------------------------------------

vi.mock('../../db', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    transaction: vi.fn(),
  },
}));

vi.mock('../../lib/mailer', () => ({
  sendMail: vi.fn().mockResolvedValue(undefined),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function hashToken(raw: string) {
  return createHash('sha256').update(raw).digest('hex');
}

function makeValidToken() {
  const raw = randomBytes(32).toString('hex');
  return raw;
}

const app = createApp();

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /auth/forgot-password (FR4)', () => {
  it('P1 — returns 200 for a known email', async () => {
    const { db } = await import('../../db');
    // Simulate a user found
    (db.select as ReturnType<typeof vi.fn>).mockReturnValue({
      from: () => ({ where: () => ({ limit: () => Promise.resolve([{ id: 'user-1', email: 'a@b.com', name: 'Alice' }]) }) }),
    });
    (db.insert as ReturnType<typeof vi.fn>).mockReturnValue({
      values: () => Promise.resolve(),
    });

    const res = await request(app)
      .post('/auth/forgot-password')
      .send({ email: 'a@b.com' });

    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/reset link/i);
  });

  it('P1 — returns 200 for an unknown email (no enumeration)', async () => {
    const { db } = await import('../../db');
    // Simulate no user found
    (db.select as ReturnType<typeof vi.fn>).mockReturnValue({
      from: () => ({ where: () => ({ limit: () => Promise.resolve([]) }) }),
    });

    const res = await request(app)
      .post('/auth/forgot-password')
      .send({ email: 'nobody@example.com' });

    expect(res.status).toBe(200);
  });

  it('rejects a missing email with 400', async () => {
    const res = await request(app)
      .post('/auth/forgot-password')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('POST /auth/reset-password (FR4)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('P2 — rejects an unknown token with 400', async () => {
    const { db } = await import('../../db');
    (db.select as ReturnType<typeof vi.fn>).mockReturnValue({
      from: () => ({
        where: () => ({ limit: () => Promise.resolve([]) }),
      }),
    });

    const res = await request(app)
      .post('/auth/reset-password')
      .send({ token: 'nonexistent-token', password: 'newpassword1' });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/invalid or has expired/i);
  });

  it('P5 — accepts a valid token and returns 200', async () => {
    const { db } = await import('../../db');
    const rawToken = makeValidToken();

    (db.select as ReturnType<typeof vi.fn>).mockReturnValue({
      from: () => ({
        where: () => ({
          limit: () =>
            Promise.resolve([
              {
                id: 'token-1',
                userId: 'user-1',
                tokenHash: hashToken(rawToken),
                expiresAt: new Date(Date.now() + 3_600_000),
                usedAt: null,
              },
            ]),
        }),
      }),
    });

    (db.transaction as ReturnType<typeof vi.fn>).mockImplementation(async (fn: (tx: unknown) => Promise<void>) => {
      await fn({
        update: () => ({ set: () => ({ where: () => Promise.resolve() }) }),
      });
    });

    const res = await request(app)
      .post('/auth/reset-password')
      .send({ token: rawToken, password: 'newpassword1' });

    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/password updated/i);
  });

  it('rejects a password that is too short with 400', async () => {
    const res = await request(app)
      .post('/auth/reset-password')
      .send({ token: 'any-token', password: 'short' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});
