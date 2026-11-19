/**
 * FR8 — Post publication  |  FR9 — Edit and delete own post
 *
 * Properties verified:
 *
 * FR8
 *  P1  Requires authentication (401).
 *  P2  Requires creator mode — returns 401 when no creator profile exists.
 *  P3  Rejects a text post without textContent (400 VALIDATION_ERROR).
 *  P4  Rejects a video post without mediaAssets (400 VALIDATION_ERROR).
 *  P5  Accepts a valid text post and returns 201.
 *
 * FR9
 *  P7  Rejects editing another user's post with 403.
 *  P8  Accepts editing own post and returns 200.
 *  P9  Accepts deleting own post and returns 204.
 *  P10 Rejects deleting another user's post with 403.
 */

import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createApp } from '../../app';
import { signToken } from '../../lib/jwt';

vi.mock('../../db', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    transaction: vi.fn(),
  },
}));

const app = createApp();
const token = signToken({ id: 'user-1', isAdmin: false });

// Valid UUIDs — the params schema rejects non-UUIDs before the service runs.
const POST_UUID = '550e8400-e29b-41d4-a716-446655440001';

const baseCreator = {
  id: 'creator-1',
  displayName: 'Alice',
  profilePicture: null,
  userId: 'user-1',
};
const basePost = {
  id: POST_UUID,
  type: 'text',
  caption: null,
  textContent: 'Hello world',
  viewCount: 0,
  moderationStatus: 'visible',
  createdAt: new Date(),
};

describe('POST /posts (FR8)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('P1 — requires auth', async () => {
    const res = await request(app).post('/posts').send({ type: 'text', textContent: 'hi' });
    expect(res.status).toBe(401);
  });

  it('P3 — rejects text post without textContent', async () => {
    const res = await request(app)
      .post('/posts')
      .set('Authorization', `Bearer ${token}`)
      .send({ type: 'text' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('P4 — rejects video post without mediaAssets', async () => {
    const res = await request(app)
      .post('/posts')
      .set('Authorization', `Bearer ${token}`)
      .send({ type: 'video' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('P2 — rejects when user has no creator profile', async () => {
    const { db } = await import('../../db');
    (db.select as ReturnType<typeof vi.fn>).mockReturnValue({
      from: () => ({
        where: () => ({ limit: () => Promise.resolve([]) }),
      }),
    });

    const res = await request(app)
      .post('/posts')
      .set('Authorization', `Bearer ${token}`)
      .send({ type: 'text', textContent: 'Hello world' });

    expect(res.status).toBe(401);
  });

  it('P5 — accepts a valid text post', async () => {
    const { db } = await import('../../db');

    (db.select as ReturnType<typeof vi.fn>).mockReturnValue({
      from: () => ({
        where: () => ({ limit: () => Promise.resolve([baseCreator]) }),
      }),
    });

    (db.transaction as ReturnType<typeof vi.fn>).mockImplementation(
      async (fn: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          insert: () => ({
            values: () => ({
              returning: () => Promise.resolve([basePost]),
            }),
          }),
        };
        return fn(tx);
      },
    );

    const res = await request(app)
      .post('/posts')
      .set('Authorization', `Bearer ${token}`)
      .send({ type: 'text', textContent: 'Hello world' });

    expect(res.status).toBe(201);
    expect(res.body.post.type).toBe('text');
  });
});

describe('PATCH /posts/:id (FR9)', () => {
  beforeEach(() => vi.clearAllMocks());

  it("P7 — rejects editing another user's post", async () => {
    const { db } = await import('../../db');

    (db.select as ReturnType<typeof vi.fn>).mockReturnValue({
      from: () => ({
        innerJoin: () => ({
          where: () => ({
            limit: () =>
              Promise.resolve([
                { post: basePost, creator: { ...baseCreator, userId: 'other-user' } },
              ]),
          }),
        }),
      }),
    });

    const res = await request(app)
      .patch(`/posts/${POST_UUID}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ caption: 'new caption' });

    expect(res.status).toBe(403);
  });

  it('P8 — accepts editing own post', async () => {
    const { db } = await import('../../db');

    (db.select as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce({
        from: () => ({
          innerJoin: () => ({
            where: () => ({
              limit: () =>
                Promise.resolve([
                  { post: basePost, creator: { ...baseCreator, userId: 'user-1' } },
                ]),
            }),
          }),
        }),
      })
      // second select: media assets after update
      .mockReturnValueOnce({
        from: () => ({ where: () => Promise.resolve([]) }),
      });

    (db.update as ReturnType<typeof vi.fn>).mockReturnValue({
      set: () => ({ where: () => Promise.resolve() }),
    });

    const res = await request(app)
      .patch(`/posts/${POST_UUID}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ caption: 'updated caption' });

    expect(res.status).toBe(200);
  });
});

describe('DELETE /posts/:id (FR9)', () => {
  beforeEach(() => vi.clearAllMocks());

  it("P10 — rejects deleting another user's post", async () => {
    const { db } = await import('../../db');

    (db.select as ReturnType<typeof vi.fn>).mockReturnValue({
      from: () => ({
        innerJoin: () => ({
          where: () => ({
            limit: () => Promise.resolve([{ creator: { ...baseCreator, userId: 'other-user' } }]),
          }),
        }),
      }),
    });

    const res = await request(app)
      .delete(`/posts/${POST_UUID}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  it('P9 — accepts deleting own post', async () => {
    const { db } = await import('../../db');

    (db.select as ReturnType<typeof vi.fn>).mockReturnValue({
      from: () => ({
        innerJoin: () => ({
          where: () => ({
            limit: () => Promise.resolve([{ creator: { ...baseCreator, userId: 'user-1' } }]),
          }),
        }),
      }),
    });

    (db.delete as ReturnType<typeof vi.fn>).mockReturnValue({
      where: () => Promise.resolve(),
    });

    const res = await request(app)
      .delete(`/posts/${POST_UUID}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(204);
  });
});
