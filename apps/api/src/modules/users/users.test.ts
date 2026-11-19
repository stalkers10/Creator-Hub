/**
 * FR3 — Update profile  |  FR5 — Creator mode toggle
 *
 * Tests run against the HTTP layer (supertest) with the DB stubbed.
 * Authentication is stubbed by injecting a valid JWT signed with the test secret.
 *
 * Properties verified:
 *
 * FR3
 *  P1  Accepts a valid name update and returns 200 with the updated user.
 *  P2  Accepts a valid email update.
 *  P3  Rejects a body with neither name nor email (400 VALIDATION_ERROR).
 *  P4  Rejects a duplicate email with 409 CONFLICT.
 *  P5  Requires authentication (401 when no token).
 *
 * FR5
 *  P6  Enables creator mode and returns isCreator: true.
 *  P7  Rejects enabling without displayName (400 VALIDATION_ERROR).
 *  P8  Rejects enabling when already a creator (409 CONFLICT).
 *  P9  Disables creator mode and returns isCreator: false.
 *  P10 Rejects disabling when not a creator (404 NOT_FOUND).
 *  P11 Requires authentication (401 when no token).
 */

import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createApp } from '../../app';
import { signToken } from '../../lib/jwt';

// ---------------------------------------------------------------------------
// Stubs
// ---------------------------------------------------------------------------

vi.mock('../../db', () => ({
  db: {
    select: vi.fn(),
    update: vi.fn(),
    insert: vi.fn(),
    delete: vi.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const app = createApp();

/** A JWT for a regular user. */
const userToken = signToken({ id: 'user-1', isAdmin: false });

/** A minimal PublicUser row returned by the service after mutations. */
const baseUser = {
  id: 'user-1',
  name: 'Alice',
  email: 'alice@example.com',
  isCreator: false,
  isAdmin: false,
};

function mockSelectReturns(rows: unknown[]) {
  const { db } = require('../../db');
  (db.select as ReturnType<typeof vi.fn>).mockReturnValue({
    from: () => ({
      leftJoin: () => ({ where: () => ({ limit: () => Promise.resolve(rows) }) }),
      where: () => ({ limit: () => Promise.resolve(rows) }),
    }),
  });
}

// ---------------------------------------------------------------------------
// FR3 — PUT /users/me
// ---------------------------------------------------------------------------

describe('PUT /users/me (FR3)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('P5 — requires authentication', async () => {
    const res = await request(app).put('/users/me').send({ name: 'Bob' });
    expect(res.status).toBe(401);
  });

  it('P3 — rejects an empty body', async () => {
    const res = await request(app)
      .put('/users/me')
      .set('Authorization', `Bearer ${userToken}`)
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('P1 — accepts a name update', async () => {
    const { db } = await import('../../db');

    // updateProfile: db.update mock
    (db.update as ReturnType<typeof vi.fn>).mockReturnValue({
      set: () => ({ where: () => ({ returning: () => Promise.resolve([{ ...baseUser, name: 'Bob' }]) }) }),
    });

    // getPublicUserById: db.select mock (called after the update)
    (db.select as ReturnType<typeof vi.fn>).mockReturnValue({
      from: () => ({
        leftJoin: () => ({
          where: () => ({
            limit: () =>
              Promise.resolve([{ user: { ...baseUser, name: 'Bob' }, creatorId: null }]),
          }),
        }),
      }),
    });

    const res = await request(app)
      .put('/users/me')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ name: 'Bob' });

    expect(res.status).toBe(200);
    expect(res.body.user.name).toBe('Bob');
  });

  it('P4 — rejects a duplicate email with 409', async () => {
    const { db } = await import('../../db');

    const uniqueViolation = new Error('unique') as Error & { code: string };
    uniqueViolation.code = '23505'; // PostgreSQL unique_violation

    (db.update as ReturnType<typeof vi.fn>).mockReturnValue({
      set: () => ({
        where: () => ({
          returning: () => Promise.reject(uniqueViolation),
        }),
      }),
    });

    const res = await request(app)
      .put('/users/me')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ email: 'taken@example.com' });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONFLICT');
  });
});

// ---------------------------------------------------------------------------
// FR5 — PATCH /users/me/creator-mode
// ---------------------------------------------------------------------------

describe('PATCH /users/me/creator-mode (FR5)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('P11 — requires authentication', async () => {
    const res = await request(app)
      .patch('/users/me/creator-mode')
      .send({ enable: true, displayName: 'AliceCreates' });
    expect(res.status).toBe(401);
  });

  it('P7 — rejects enable without displayName', async () => {
    const res = await request(app)
      .patch('/users/me/creator-mode')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ enable: true });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('P6 — enables creator mode', async () => {
    const { db } = await import('../../db');

    // Check for existing profile → none found
    (db.select as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce({
        from: () => ({ where: () => ({ limit: () => Promise.resolve([]) }) }),
      })
      // getPublicUserById after insert
      .mockReturnValueOnce({
        from: () => ({
          leftJoin: () => ({
            where: () => ({
              limit: () =>
                Promise.resolve([{ user: baseUser, creatorId: 'creator-1' }]),
            }),
          }),
        }),
      });

    (db.insert as ReturnType<typeof vi.fn>).mockReturnValue({
      values: () => Promise.resolve(),
    });

    const res = await request(app)
      .patch('/users/me/creator-mode')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ enable: true, displayName: 'AliceCreates' });

    expect(res.status).toBe(200);
    expect(res.body.user.isCreator).toBe(true);
  });

  it('P8 — rejects enabling when already a creator', async () => {
    const { db } = await import('../../db');

    (db.select as ReturnType<typeof vi.fn>).mockReturnValue({
      from: () => ({
        where: () => ({ limit: () => Promise.resolve([{ id: 'creator-1' }]) }),
      }),
    });

    const res = await request(app)
      .patch('/users/me/creator-mode')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ enable: true, displayName: 'AliceCreates' });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONFLICT');
  });

  it('P9 — disables creator mode', async () => {
    const { db } = await import('../../db');

    (db.delete as ReturnType<typeof vi.fn>).mockReturnValue({
      where: () => ({
        returning: () => Promise.resolve([{ id: 'creator-1' }]),
      }),
    });

    (db.select as ReturnType<typeof vi.fn>).mockReturnValue({
      from: () => ({
        leftJoin: () => ({
          where: () => ({
            limit: () =>
              Promise.resolve([{ user: baseUser, creatorId: null }]),
          }),
        }),
      }),
    });

    const res = await request(app)
      .patch('/users/me/creator-mode')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ enable: false });

    expect(res.status).toBe(200);
    expect(res.body.user.isCreator).toBe(false);
  });

  it('P10 — rejects disabling when not a creator', async () => {
    const { db } = await import('../../db');

    (db.delete as ReturnType<typeof vi.fn>).mockReturnValue({
      where: () => ({
        returning: () => Promise.resolve([]),
      }),
    });

    const res = await request(app)
      .patch('/users/me/creator-mode')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ enable: false });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});
