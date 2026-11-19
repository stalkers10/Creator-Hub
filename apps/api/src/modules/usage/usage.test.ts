/**
 * FR14 — Today's quota  |  FR15 — Heartbeat  |  FR16 — Device registration
 * FR17 — Quota enforcement (quotaGuard)  |  FR21 — Subscriber bypass
 *
 * Properties verified:
 *
 * FR16
 *  P1  POST /devices/register returns 400 when X-Device-Id header is missing.
 *  P2  POST /devices/register returns 200 when header is a valid UUID.
 *
 * FR15
 *  P3  POST /usage/heartbeat returns 400 when body is missing elapsed.
 *  P4  POST /usage/heartbeat returns updated quota.
 *
 * FR14
 *  P5  GET /usage/today returns quota status.
 *
 * FR17 / FR21 (via feed route which uses quotaGuard)
 *  P6  GET /feed passes through when quota is not exhausted.
 *  P7  GET /feed returns 402 when quota is exhausted (no subscription).
 *  P8  GET /feed passes through for a subscriber regardless of usage (FR21).
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

// Mock the usage service so quota-guard tests don't have to simulate
// the full DB call chain of computeQuotaStatus.
vi.mock('../../modules/usage/usage.service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../modules/usage/usage.service')>();
  return {
    ...actual,
    computeQuotaStatus: vi.fn(),
    registerDevice: vi.fn().mockResolvedValue(undefined),
    recordHeartbeat: vi.fn(),
    getTodayQuota: vi.fn(),
  };
});

const app = createApp();
const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';
const userToken = signToken({ id: 'user-1', isAdmin: false });

// ---------------------------------------------------------------------------
// FR16 — Device registration
// ---------------------------------------------------------------------------

describe('POST /devices/register (FR16)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('P1 — rejects missing X-Device-Id', async () => {
    const res = await request(app).post('/devices/register');
    expect(res.status).toBe(400);
  });

  it('P2 — accepts a valid UUID header', async () => {
    // registerDevice is already mocked to resolve
    const res = await request(app).post('/devices/register').set('x-device-id', VALID_UUID);

    expect(res.status).toBe(200);
    expect(res.body.deviceId).toBe(VALID_UUID);
  });
});

// ---------------------------------------------------------------------------
// FR15 — Heartbeat
// ---------------------------------------------------------------------------

describe('POST /usage/heartbeat (FR15)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('P3 — rejects missing elapsed', async () => {
    const res = await request(app).post('/usage/heartbeat').set('x-device-id', VALID_UUID).send({});
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('P4 — returns quota status', async () => {
    const usageService = await import('../../modules/usage/usage.service');
    const quota = {
      unlimited: false,
      remainingSeconds: 600,
      dailyLimitSeconds: 900,
      resetsAt: '2026-11-20T23:00:00.000Z',
      warning: false,
    };
    (usageService.recordHeartbeat as ReturnType<typeof vi.fn>).mockResolvedValue(quota);

    const res = await request(app)
      .post('/usage/heartbeat')
      .set('x-device-id', VALID_UUID)
      .send({ elapsed: 15 });

    expect(res.status).toBe(200);
    expect(res.body.quota.remainingSeconds).toBe(600);
  });
});

// ---------------------------------------------------------------------------
// FR14 — Today's quota
// ---------------------------------------------------------------------------

describe('GET /usage/today (FR14)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('P5 — returns quota for a visitor', async () => {
    const usageService = await import('../../modules/usage/usage.service');
    const quota = {
      unlimited: false,
      remainingSeconds: 600,
      dailyLimitSeconds: 900,
      resetsAt: '2026-11-20T23:00:00.000Z',
      warning: false,
    };
    (usageService.getTodayQuota as ReturnType<typeof vi.fn>).mockResolvedValue(quota);

    const res = await request(app).get('/usage/today').set('x-device-id', VALID_UUID);

    expect(res.status).toBe(200);
    expect(res.body.quota.remainingSeconds).toBe(600);
    expect(res.body.quota.unlimited).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// FR17 / FR21 — quotaGuard via GET /feed
// ---------------------------------------------------------------------------

describe('GET /feed — quota guard (FR17 / FR21)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('P6 — passes through when quota is not exhausted', async () => {
    const usageService = await import('../../modules/usage/usage.service');
    const { db } = await import('../../db');

    // Quota: 600 s remaining
    (usageService.computeQuotaStatus as ReturnType<typeof vi.fn>).mockResolvedValue({
      unlimited: false,
      remainingSeconds: 600,
      dailyLimitSeconds: 900,
      resetsAt: '2026-11-20T23:00:00.000Z',
      warning: false,
    });

    // Feed: no posts (empty page)
    (db.select as ReturnType<typeof vi.fn>).mockReturnValue({
      from: () => ({
        where: () => ({ limit: () => Promise.resolve([]) }),
        innerJoin: () => ({
          where: () => ({ orderBy: () => ({ limit: () => Promise.resolve([]) }) }),
        }),
      }),
    });

    const res = await request(app).get('/feed').set('x-device-id', VALID_UUID);
    expect(res.status).toBe(200);
    expect(res.body.quota.remainingSeconds).toBe(600);
  });

  it('P7 — returns 402 when quota is exhausted', async () => {
    const usageService = await import('../../modules/usage/usage.service');

    (usageService.computeQuotaStatus as ReturnType<typeof vi.fn>).mockResolvedValue({
      unlimited: false,
      remainingSeconds: 0,
      dailyLimitSeconds: 900,
      resetsAt: '2026-11-20T23:00:00.000Z',
      warning: false,
    });

    const res = await request(app).get('/feed').set('x-device-id', VALID_UUID);
    expect(res.status).toBe(402);
    expect(res.body.error.code).toBe('QUOTA_EXHAUSTED');
  });

  it('P8 — subscriber bypasses quota (FR21)', async () => {
    const usageService = await import('../../modules/usage/usage.service');
    const { db } = await import('../../db');

    (usageService.computeQuotaStatus as ReturnType<typeof vi.fn>).mockResolvedValue({
      unlimited: true,
      remainingSeconds: null,
      dailyLimitSeconds: null,
      resetsAt: null,
      warning: false,
    });

    // The feed service calls db.select().from(follows).where() — awaited directly (no .limit()).
    // Then db.select(postFields).from(posts).innerJoin().where().orderBy().limit().
    // The mock must support both patterns.
    const emptyPromise = Promise.resolve([]);
    const terminal = {
      limit: () => emptyPromise,
      orderBy: () => ({ limit: () => emptyPromise }),
      then: (fn: (v: unknown[]) => unknown, r?: unknown) => emptyPromise.then(fn, r as never),
    };
    (db.select as ReturnType<typeof vi.fn>).mockReturnValue({
      from: () => ({
        where: () => terminal,
        innerJoin: () => ({ where: () => terminal }),
      }),
    });

    const res = await request(app)
      .get('/feed')
      .set('Authorization', `Bearer ${userToken}`)
      .set('x-device-id', VALID_UUID);

    expect(res.status).toBe(200);
    expect(res.body.quota.unlimited).toBe(true);
  });
});
