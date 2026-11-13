import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { createApp } from './app';

const app = createApp();

describe('API base', () => {
  it('answers the health check', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('returns a JSON 404 for unknown routes', async () => {
    const res = await request(app).get('/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('answers 501 for endpoints that are not built yet', async () => {
    const res = await request(app).get('/feed');
    expect(res.status).toBe(501);
    expect(res.body.error.code).toBe('NOT_IMPLEMENTED');
  });

  it('rejects invalid registration data before touching the database', async () => {
    const res = await request(app).post('/auth/register').send({ email: 'nope', password: '1' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('requires a token on protected routes', async () => {
    const res = await request(app).get('/users/me');
    expect(res.status).toBe(401);
  });

  it('keeps admin routes away from non-admins', async () => {
    const res = await request(app).get('/admin/dashboard');
    expect(res.status).toBe(401);
  });
});
