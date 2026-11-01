import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildTestApp, setupTestApp } from '../helpers/app.js';
import { API, call } from '../helpers/api.js';
import { buildRegisterPayload } from '../helpers/auth.js';

const ALLOWED_ORIGIN = 'http://localhost:5173'; // ALLOWED_ORIGINS in test/setup-env.ts

describe('HTTP headers', () => {
  const ctx = setupTestApp();

  describe('security headers (helmet)', () => {
    it('sets the standard protective headers', async () => {
      const res = await call(ctx.app, { method: 'GET', url: '/healthz' });

      expect(res.headers).toMatchObject({
        'x-content-type-options': 'nosniff',
        'x-frame-options': 'SAMEORIGIN',
        'strict-transport-security': expect.stringContaining('max-age='),
        'content-security-policy': expect.stringContaining("default-src 'self'"),
      });
    });

    it('does not reveal the server technology', async () => {
      const res = await call(ctx.app, { method: 'GET', url: '/healthz' });

      expect(res.headers['x-powered-by']).toBeUndefined();
    });
  });

  describe('CORS', () => {
    const preflight = (origin: string, requestHeaders = 'content-type') =>
      call(ctx.app, {
        method: 'OPTIONS',
        url: `${API}/auth/login`,
        headers: {
          origin,
          'access-control-request-method': 'POST',
          'access-control-request-headers': requestHeaders,
        },
      });

    it('allows a preflight from an allowed origin, with credentials', async () => {
      const res = await preflight(ALLOWED_ORIGIN);

      expect(res.statusCode).toBe(204);
      expect(res.headers).toMatchObject({
        'access-control-allow-origin': ALLOWED_ORIGIN,
        'access-control-allow-credentials': 'true',
        'access-control-allow-methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
        'access-control-allow-headers': 'Content-Type, Authorization',
      });
    });

    it('only allows the Content-Type and Authorization request headers', async () => {
      const res = await preflight(ALLOWED_ORIGIN, 'x-custom-header');

      expect(res.headers['access-control-allow-headers']).toBe('Content-Type, Authorization');
    });

    it('gives a disallowed origin no CORS permission', async () => {
      const res = await preflight('https://evil.example');

      expect(res.headers['access-control-allow-origin']).toBeUndefined();
    });

    it('adds the CORS headers to actual requests from an allowed origin', async () => {
      const res = await call(ctx.app, {
        method: 'GET',
        url: '/healthz',
        headers: { origin: ALLOWED_ORIGIN },
      });

      expect(res.headers['access-control-allow-origin']).toBe(ALLOWED_ORIGIN);
    });
  });

  describe('refresh cookie', () => {
    afterEach(() => {
      vi.unstubAllEnvs();
    });

    it('is not marked Secure outside production, so it works over plain http locally', async () => {
      const res = await call(ctx.app, {
        method: 'POST',
        url: `${API}/auth/register`,
        payload: buildRegisterPayload(),
      });

      expect(res.cookies.find((c) => c.name === 'refreshToken')?.secure).toBeFalsy();
    });

    it('is marked Secure in production', async () => {
      vi.stubEnv('NODE_ENV', 'production');
      const { app } = await buildTestApp();

      try {
        const res = await call(app, {
          method: 'POST',
          url: `${API}/auth/register`,
          payload: buildRegisterPayload(),
        });

        expect(res.cookies.find((c) => c.name === 'refreshToken')?.secure).toBe(true);
      } finally {
        await app.close();
      }
    });
  });
});
