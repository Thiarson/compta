import { describe, expect, it } from 'vitest';
import { setupTestApp } from '../helpers/app.js';
import { API, call } from '../helpers/api.js';

import type { InjectOptions } from 'fastify';

let ipCount = 0;
/** An IP no other test uses, so every test starts with a full rate-limit budget. */
const freshIp = () => `192.0.2.${++ipCount}`;

/** Per-route limits from auth.route.ts. Invalid bodies are fine: limits apply before validation. */
const LIMITED_ROUTES = [
  { url: `${API}/auth/register`, max: 5 },
  { url: `${API}/auth/login`, max: 10 },
  { url: `${API}/auth/resend-verification`, max: 3 },
  { url: `${API}/auth/forgot-password`, max: 3 },
  { url: `${API}/auth/reset-password`, max: 5 },
];
const GLOBAL_MAX = 100;

describe('rate limiting', () => {
  const ctx = setupTestApp();

  /** Sends `count` requests from `ip`, one after another, and returns every response. */
  async function send(count: number, ip: string, options: InjectOptions) {
    const responses = [];
    for (let i = 0; i < count; i++) {
      responses.push(await call(ctx.app, { ...options, remoteAddress: ip }));
    }
    return responses;
  }

  describe.each(LIMITED_ROUTES)('POST $url', ({ url, max }) => {
    it(`allows ${max} requests, then answers 429 in the standard error shape`, async () => {
      const ip = freshIp();

      const allowed = await send(max, ip, { method: 'POST', url, payload: {} });
      const [blocked] = await send(1, ip, { method: 'POST', url, payload: {} });

      expect(allowed.map((r) => r.statusCode)).not.toContain(429);
      expect(blocked.statusCode).toBe(429);
      expect(blocked.json()).toEqual({
        statusCode: 429,
        code: 'TOO_MANY_REQUESTS',
        message: expect.any(String),
      });
      expect(blocked.headers['retry-after']).toBeDefined();
    });
  });

  it(`applies the global limit of ${GLOBAL_MAX} requests per minute to other routes`, async () => {
    const ip = freshIp();

    const allowed = await send(GLOBAL_MAX, ip, { method: 'GET', url: '/healthz' });
    const [blocked] = await send(1, ip, { method: 'GET', url: '/healthz' });

    expect(allowed.every((r) => r.statusCode === 200)).toBe(true);
    expect(blocked.statusCode).toBe(429);
  });

  it('advertises the limit and remaining budget on normal responses', async () => {
    const [res] = await send(1, freshIp(), {
      method: 'POST',
      url: `${API}/auth/login`,
      payload: {},
    });

    expect(res.headers['x-ratelimit-limit']).toBe('10');
    expect(res.headers['x-ratelimit-remaining']).toBe('9');
  });

  it('counts each client IP separately', async () => {
    const forgot = { method: 'POST', url: `${API}/auth/forgot-password`, payload: {} } as const;
    await send(4, freshIp(), forgot);

    const [otherClient] = await send(1, freshIp(), forgot);

    expect(otherClient.statusCode).not.toBe(429);
  });

  it('keeps a separate budget per route', async () => {
    const ip = freshIp();
    await send(4, ip, { method: 'POST', url: `${API}/auth/forgot-password`, payload: {} });

    const [login] = await send(1, ip, { method: 'POST', url: `${API}/auth/login`, payload: {} });

    expect(login.statusCode).not.toBe(429);
  });
});
