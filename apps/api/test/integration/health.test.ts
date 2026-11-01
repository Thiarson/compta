import { describe, expect, it, onTestFinished, vi } from 'vitest';
import { setupTestApp } from '../helpers/app.js';
import { call } from '../helpers/api.js';

describe('health', () => {
  const ctx = setupTestApp();

  it('GET /healthz reports liveness with the uptime, without authentication', async () => {
    const res = await call(ctx.app, { method: 'GET', url: '/healthz' });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ok', uptime: expect.any(Number) });
  });

  it('GET /readyz reports readiness when the database is reachable', async () => {
    const res = await call(ctx.app, { method: 'GET', url: '/readyz' });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ok' });
  });

  it('is not served under the /api/v1 prefix', async () => {
    const res = await call(ctx.app, { method: 'GET', url: '/api/v1/healthz' });

    expect(res.statusCode).toBe(404);
  });

  /** Makes every database query fail until the end of the current test. */
  function simulateDatabaseDown() {
    const spy = vi
      .spyOn(ctx.app.db, 'execute')
      .mockRejectedValue(new Error('ECONNREFUSED 10.0.0.5:5432'));
    onTestFinished(() => spy.mockRestore());
  }

  it('GET /readyz answers 503 without leaking the cause when the database is unreachable', async () => {
    simulateDatabaseDown();

    const res = await call(ctx.app, { method: 'GET', url: '/readyz' });

    expect(res.statusCode).toBe(503);
    expect(res.json()).toEqual({ status: 'unavailable' });
  });

  it('GET /healthz stays up when the database is unreachable', async () => {
    simulateDatabaseDown();

    const res = await call(ctx.app, { method: 'GET', url: '/healthz' });

    expect(res.statusCode).toBe(200);
  });
});
