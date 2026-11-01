import { sql } from 'drizzle-orm';
import { Redis } from 'ioredis';
import { describe, expect, it, onTestFinished, vi } from 'vitest';
import { buildTestApp } from '../helpers/app.js';
import { API, call } from '../helpers/api.js';

const UNREACHABLE_REDIS = 'redis://127.0.0.1:1'; // nothing listens on port 1

/** Boots a separate app with environment overrides, closed when the test ends. */
async function bootWith(env: Record<string, string>) {
  for (const [name, value] of Object.entries(env)) vi.stubEnv(name, value);
  const { app } = await buildTestApp();
  onTestFinished(async () => {
    await app.close();
    vi.unstubAllEnvs();
  });
  return app;
}

describe('app lifecycle', () => {
  it('ends its database connection on close()', async () => {
    const { app } = await buildTestApp();

    await app.close();

    await expect(app.db.execute(sql`select 1`)).rejects.toThrow();
  });

  it('falls back to the in-memory rate-limit store when REDIS_URL is malformed', async () => {
    const app = await bootWith({ REDIS_URL: 'not a url' });

    const res = await call(app, { method: 'GET', url: '/healthz' });

    expect(res.statusCode).toBe(200);
    expect(res.headers['x-ratelimit-limit']).toBe('100');
  });

  describe('when Redis is unreachable', () => {
    it('keeps serving routes with the default limit (fails open)', async () => {
      const app = await bootWith({ REDIS_URL: UNREACHABLE_REDIS });

      const res = await call(app, { method: 'GET', url: '/healthz' });

      expect(res.statusCode).toBe(200);
    });

    it('refuses the rate-limited auth routes rather than skip their limit (fails closed)', async () => {
      const app = await bootWith({ REDIS_URL: UNREACHABLE_REDIS });

      const res = await call(app, { method: 'POST', url: `${API}/auth/login`, payload: {} });

      expect(res.statusCode).toBe(500);
      expect(res.json().code).toBe('INTERNAL_SERVER_ERROR');
    });

    it('disconnects the Redis client on close()', async () => {
      vi.stubEnv('REDIS_URL', UNREACHABLE_REDIS);
      onTestFinished(() => {
        vi.unstubAllEnvs();
      });
      const disconnect = vi.spyOn(Redis.prototype, 'disconnect');
      onTestFinished(() => disconnect.mockRestore());
      const { app } = await buildTestApp();

      await app.close();

      expect(disconnect).toHaveBeenCalled();
    });
  });
});
