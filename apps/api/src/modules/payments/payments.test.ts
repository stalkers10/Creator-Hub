/**
 * FR30 — Initiate payment  |  FR31/FR34 — Webhook  |  FR33 — History
 *
 * Properties verified:
 *  P1  POST /payments requires auth (401).
 *  P2  POST /payments returns 400 on invalid body.
 *  P3  POST /payments returns 404 when subscription not found.
 *  P4  POST /payments returns 403 when subscription belongs to another user.
 *  P5  POST /payments initiates successfully and returns 201.
 *  P6  POST /payments/webhook/campay asks CamPay to retry an unknown reference.
 *  P7  POST /payments/webhook/campay is idempotent for already-processed payments (FR34).
 *  P8  GET /payments/me requires auth (401).
 *  P9  GET /payments/me returns payment history.
 */

import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createApp } from '../../app';
import { signToken } from '../../lib/jwt';

vi.mock('../../db', () => ({
  db: { select: vi.fn(), insert: vi.fn(), update: vi.fn(), delete: vi.fn(), transaction: vi.fn() },
}));

// Mock Campay so tests don't make real HTTP calls.
vi.mock('../../lib/campay', () => ({
  initiateCollection: vi.fn(),
  getTransactionStatus: vi.fn(),
  verifyWebhookSignature: vi.fn((signature: string) => signature === 'valid-signature'),
  _resetTokenCache: vi.fn(),
}));

const app = createApp();
const token = signToken({ id: 'user-1', isAdmin: false });

const SUB_UUID = '550e8400-e29b-41d4-a716-446655440020';
const PAY_UUID = '550e8400-e29b-41d4-a716-446655440021';
const PLAN_UUID = '550e8400-e29b-41d4-a716-446655440022';

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
  status: 'pending',
  startDate: null,
  endDate: null,
  createdAt: new Date(),
};
const basePayment = {
  id: PAY_UUID,
  subscriptionId: SUB_UUID,
  amount: 2000,
  currency: 'XAF',
  operator: 'mtn',
  phoneNumber: '+237600000000',
  providerReference: 'campay-ref-1',
  status: 'pending',
  createdAt: new Date(),
  confirmedAt: null,
};

describe('POST /payments (FR30)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('P1 — requires auth', async () => {
    const res = await request(app)
      .post('/payments')
      .send({ subscriptionId: SUB_UUID, operator: 'mtn', phoneNumber: '+237600000000' });
    expect(res.status).toBe(401);
  });

  it('P2 — rejects invalid body', async () => {
    const res = await request(app)
      .post('/payments')
      .set('Authorization', `Bearer ${token}`)
      .send({ operator: 'mtn' }); // missing subscriptionId and phoneNumber
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('P3 — returns 404 for unknown subscription', async () => {
    const { db } = await import('../../db');
    (db.select as ReturnType<typeof vi.fn>).mockReturnValue({
      from: () => ({
        innerJoin: () => ({ where: () => ({ limit: () => Promise.resolve([]) }) }),
      }),
    });

    const res = await request(app)
      .post('/payments')
      .set('Authorization', `Bearer ${token}`)
      .send({ subscriptionId: SUB_UUID, operator: 'mtn', phoneNumber: '+237600000000' });

    expect(res.status).toBe(404);
  });

  it('P4 — returns 403 when subscription belongs to another user', async () => {
    const { db } = await import('../../db');
    (db.select as ReturnType<typeof vi.fn>).mockReturnValue({
      from: () => ({
        innerJoin: () => ({
          where: () => ({
            limit: () =>
              Promise.resolve([{ sub: { ...baseSub, userId: 'other' }, plan: basePlan }]),
          }),
        }),
      }),
    });

    const res = await request(app)
      .post('/payments')
      .set('Authorization', `Bearer ${token}`)
      .send({ subscriptionId: SUB_UUID, operator: 'mtn', phoneNumber: '+237600000000' });

    expect(res.status).toBe(403);
  });

  it('P5 — initiates payment and returns 201', async () => {
    const { db } = await import('../../db');
    const campay = await import('../../lib/campay');

    (db.select as ReturnType<typeof vi.fn>).mockReturnValue({
      from: () => ({
        innerJoin: () => ({
          where: () => ({ limit: () => Promise.resolve([{ sub: baseSub, plan: basePlan }]) }),
        }),
      }),
    });
    (db.insert as ReturnType<typeof vi.fn>).mockReturnValue({
      values: () => ({ returning: () => Promise.resolve([basePayment]) }),
    });
    (db.update as ReturnType<typeof vi.fn>).mockReturnValue({
      set: () => ({
        where: () => ({
          returning: () => Promise.resolve([{ ...basePayment, providerReference: 'campay-ref-1' }]),
        }),
      }),
    });
    (campay.initiateCollection as ReturnType<typeof vi.fn>).mockResolvedValue({
      reference: 'campay-ref-1',
      status: 'PENDING',
    });

    const res = await request(app)
      .post('/payments')
      .set('Authorization', `Bearer ${token}`)
      .send({ subscriptionId: SUB_UUID, operator: 'mtn', phoneNumber: '+237600000000' });

    expect(res.status).toBe(201);
    expect(res.body.payment.providerReference).toBe('campay-ref-1');
  });
});

describe('POST /payments/webhook/campay (FR31/FR34)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('P6 — returns 500 for unknown reference so CamPay can retry', async () => {
    const { db } = await import('../../db');
    (db.select as ReturnType<typeof vi.fn>).mockReturnValue({
      from: () => ({ where: () => ({ limit: () => Promise.resolve([]) }) }),
    });

    const res = await request(app)
      .post('/payments/webhook/campay')
      .send({ reference: 'unknown-ref', signature: 'valid-signature' });

    expect(res.status).toBe(500);
  });

  it('P7 — returns 200 immediately for already-processed payment (FR34 idempotency)', async () => {
    const { db } = await import('../../db');
    (db.select as ReturnType<typeof vi.fn>).mockReturnValue({
      from: () => ({
        where: () => ({ limit: () => Promise.resolve([{ ...basePayment, status: 'success' }]) }),
      }),
    });

    const res = await request(app)
      .post('/payments/webhook/campay')
      .send({ reference: 'campay-ref-1', status: 'SUCCESSFUL', signature: 'valid-signature' });

    expect(res.status).toBe(200);
    // Campay status check should NOT be called for already-processed payments.
    const campay = await import('../../lib/campay');
    expect(campay.getTransactionStatus).not.toHaveBeenCalled();
  });

  it('P10 — rejects request with invalid signature (401)', async () => {
    const res = await request(app)
      .post('/payments/webhook/campay')
      .send({ reference: 'any-ref', signature: 'invalid-signature' });

    expect(res.status).toBe(401);
  });

  it('P11 — verifies signature and requests a retry for unknown reference', async () => {
    const { db } = await import('../../db');

    (db.select as ReturnType<typeof vi.fn>).mockReturnValue({
      from: () => ({ where: () => ({ limit: () => Promise.resolve([]) }) }),
    });

    const res = await request(app)
      .post('/payments/webhook/campay')
      .send({ reference: 'unknown-ref', signature: 'valid-signature' });

    expect(res.status).toBe(500);
    const campay = await import('../../lib/campay');
    expect(campay.verifyWebhookSignature).toHaveBeenCalledWith('valid-signature');
  });
});

describe('GET /payments/me (FR33)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('P8 — requires auth', async () => {
    const res = await request(app).get('/payments/me');
    expect(res.status).toBe(401);
  });

  it('P9 — returns payment history', async () => {
    const { db } = await import('../../db');
    (db.select as ReturnType<typeof vi.fn>).mockReturnValue({
      from: () => ({
        innerJoin: () => ({
          where: () => ({
            orderBy: () => ({
              then: (fn: (v: unknown) => unknown) => fn([{ payments: basePayment }]),
            }),
          }),
        }),
      }),
    });

    const res = await request(app).get('/payments/me').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.payments).toHaveLength(1);
  });
});
