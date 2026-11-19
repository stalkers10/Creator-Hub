/**
 * FR11 — Follow / unfollow creator (toggle)
 *
 * Properties verified:
 *  P1  Requires authentication (401).
 *  P2  Returns 404 when the creator does not exist.
 *  P3  Returns { following: true } when successfully following.
 *  P4  Returns { following: false } when successfully unfollowing.
 */

import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createApp } from '../../app';
import { signToken } from '../../lib/jwt';

vi.mock('../../db', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    delete: vi.fn(),
  },
}));

const app = createApp();
const token = signToken({ id: 'user-1', isAdmin: false });
const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';

describe('POST /creators/:id/follow (FR11)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('P1 — requires auth', async () => {
    const res = await request(app).post(`/creators/${VALID_UUID}/follow`);
    expect(res.status).toBe(401);
  });

  it('P2 — returns 404 for unknown creator', async () => {
    const { db } = await import('../../db');
    (db.select as ReturnType<typeof vi.fn>).mockReturnValue({
      from: () => ({ where: () => ({ limit: () => Promise.resolve([]) }) }),
    });

    const res = await request(app)
      .post(`/creators/${VALID_UUID}/follow`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  it('P3 — follows a creator', async () => {
    const { db } = await import('../../db');
    (db.select as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce({
        from: () => ({ where: () => ({ limit: () => Promise.resolve([{ id: VALID_UUID }]) }) }),
      })
      .mockReturnValueOnce({
        from: () => ({ where: () => ({ limit: () => Promise.resolve([]) }) }),
      });

    (db.insert as ReturnType<typeof vi.fn>).mockReturnValue({
      values: () => Promise.resolve(),
    });

    const res = await request(app)
      .post(`/creators/${VALID_UUID}/follow`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.following).toBe(true);
  });

  it('P4 — unfollows a creator', async () => {
    const { db } = await import('../../db');
    (db.select as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce({
        from: () => ({ where: () => ({ limit: () => Promise.resolve([{ id: VALID_UUID }]) }) }),
      })
      .mockReturnValueOnce({
        from: () => ({ where: () => ({ limit: () => Promise.resolve([{ followerId: 'user-1' }]) }) }),
      });

    (db.delete as ReturnType<typeof vi.fn>).mockReturnValue({
      where: () => Promise.resolve(),
    });

    const res = await request(app)
      .post(`/creators/${VALID_UUID}/follow`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.following).toBe(false);
  });
});
