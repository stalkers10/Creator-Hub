/**
 * FR22 — List plans  |  FR23 — Create subscription
 * FR24/FR29 — My subscriptions  |  FR28 — Cancel
 *
 * Properties verified:
 *  P1  GET /plans returns 200 with plans array (no auth required).
 *  P2  POST /subscriptions requires auth (401).
 *  P3  POST /subscriptions returns 404 when plan does not exist.
 *  P4  POST /subscriptions returns 201 with a pending subscription.
 *  P5  GET /subscriptions/me requires auth (401).
 *  P6  GET /subscriptions/me returns the user's subscriptions.
 *  P7  POST /subscriptions/:id/cancel requires auth (401).
 *  P8  POST /subscriptions/:id/cancel returns 403 when not owner.
 *  P9  POST /subscriptions/:id/cancel returns 403 when status is not 'active'.
 *  P10 POST /subscriptions/:id/cancel returns 200 with the cancelled subscription.
 */

import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createApp } from '../../app';
import { signToken } from '../../lib/jwt';

vi.mock('../../db', () => ({
  db: { select: vi.fn(), insert: vi.fn(), update: vi.fn(), delete: vi.fn() },
}));

const app = createApp();
const token = signToken({ id: 'user-1', isAdmin: false });
const PLAN_UUID = '550e8400-e29b-41d4-a716-446655440010';
const SUB_UUID = '550e8400-e29b-41d4-a716-446655440011';

const basePlan = {
  id: PLAN_UUID,
  name: 'Monthly',
  durationDays: 30,
  priceXaf: 2000,
  isActive: true,
};
const baseSub = {
  id: SUB_UUID,
  userId: 'user-1',
  planId: PLAN_UUID,
  status: 'active',
  startDate: new Date(),
  endDate: new Date(Date.now() + 86400_000 * 30),
  createdAt: new Date(),
};

describe('GET /plans (FR22)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('P1 — returns plans without auth', async () => {
    const { db } = await import('../../db');
    (db.select as ReturnType<typeof vi.fn>).mockReturnValue({
      from: () => ({ where: () => Promise.resolve([basePlan]) }),
    });

    const res = await request(app).get('/plans');
    expect(res.status).toBe(200);
    expect(res.body.plans).toHaveLength(1);
    expect(res.body.plans[0].name).toBe('Monthly');
  });
});

describe('POST /subscriptions (FR23)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('P2 — requires auth', async () => {
    const res = await request(app).post('/subscriptions').send({ planId: PLAN_UUID });
    expect(res.status).toBe(401);
  });

  it('P3 — returns 404 for unknown plan', async () => {
    const { db } = await import('../../db');
    (db.select as ReturnType<typeof vi.fn>).mockReturnValue({
      from: () => ({ where: () => ({ limit: () => Promise.resolve([]) }) }),
    });

    const res = await request(app)
      .post('/subscriptions')
      .set('Authorization', `Bearer ${token}`)
      .send({ planId: PLAN_UUID });

    expect(res.status).toBe(404);
  });

  it('P4 — creates a pending subscription', async () => {
    const { db } = await import('../../db');
    (db.select as ReturnType<typeof vi.fn>).mockReturnValue({
      from: () => ({ where: () => ({ limit: () => Promise.resolve([basePlan]) }) }),
    });
    (db.insert as ReturnType<typeof vi.fn>).mockReturnValue({
      values: () => ({ returning: () => Promise.resolve([{ ...baseSub, status: 'pending' }]) }),
    });

    const res = await request(app)
      .post('/subscriptions')
      .set('Authorization', `Bearer ${token}`)
      .send({ planId: PLAN_UUID });

    expect(res.status).toBe(201);
    expect(res.body.subscription.status).toBe('pending');
  });
});

describe('GET /subscriptions/me (FR24/FR29)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('P5 — requires auth', async () => {
    const res = await request(app).get('/subscriptions/me');
    expect(res.status).toBe(401);
  });

  it('P6 — returns subscriptions', async () => {
    const { db } = await import('../../db');
    (db.select as ReturnType<typeof vi.fn>).mockReturnValue({
      from: () => ({
        where: () => ({ orderBy: () => Promise.resolve([baseSub]) }),
      }),
    });

    const res = await request(app).get('/subscriptions/me').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.subscriptions).toHaveLength(1);
  });
});

describe('POST /subscriptions/:id/cancel (FR28)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('P7 — requires auth', async () => {
    const res = await request(app).post(`/subscriptions/${SUB_UUID}/cancel`);
    expect(res.status).toBe(401);
  });

  it('P8 — returns 403 when not owner', async () => {
    const { db } = await import('../../db');
    (db.select as ReturnType<typeof vi.fn>).mockReturnValue({
      from: () => ({
        where: () => ({ limit: () => Promise.resolve([{ ...baseSub, userId: 'other-user' }]) }),
      }),
    });

    const res = await request(app)
      .post(`/subscriptions/${SUB_UUID}/cancel`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  it('P9 — returns 403 when status is not active', async () => {
    const { db } = await import('../../db');
    (db.select as ReturnType<typeof vi.fn>).mockReturnValue({
      from: () => ({
        where: () => ({ limit: () => Promise.resolve([{ ...baseSub, status: 'expired' }]) }),
      }),
    });

    const res = await request(app)
      .post(`/subscriptions/${SUB_UUID}/cancel`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  it('P10 — cancels an active subscription', async () => {
    const { db } = await import('../../db');
    (db.select as ReturnType<typeof vi.fn>).mockReturnValue({
      from: () => ({ where: () => ({ limit: () => Promise.resolve([baseSub]) }) }),
    });
    (db.update as ReturnType<typeof vi.fn>).mockReturnValue({
      set: () => ({
        where: () => ({ returning: () => Promise.resolve([{ ...baseSub, status: 'cancelled' }]) }),
      }),
    });

    const res = await request(app)
      .post(`/subscriptions/${SUB_UUID}/cancel`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.subscription.status).toBe('cancelled');
  });
});
