import { eq } from 'drizzle-orm';
import { describe, expect, it, vi } from 'vitest';
import { refreshTokens, users } from '@compta/db';
import { setupTestApp } from '../../helpers/app.js';
import { API, call, cookieValue } from '../../helpers/api.js';
import { login, registerUser } from '../../helpers/auth.js';
import { hashToken } from '../../../src/utils/token.js';

const COOKIE = 'refreshToken';
const DAY_MS = 24 * 3600 * 1000;

describe('session', () => {
  const ctx = setupTestApp();

  const refresh = (token?: string) =>
    call(ctx.app, {
      method: 'POST',
      url: `${API}/auth/refresh`,
      cookies: token ? { [COOKIE]: token } : {},
    });
  const logout = (token?: string) =>
    call(ctx.app, {
      method: 'POST',
      url: `${API}/auth/logout`,
      cookies: token ? { [COOKIE]: token } : {},
    });
  const findRow = async (token: string) =>
    (
      await ctx.app.db
        .select()
        .from(refreshTokens)
        .where(eq(refreshTokens.tokenHash, hashToken(token)))
    )[0];

  describe('POST /auth/refresh', () => {
    it('rotates the refresh token and returns a new access token', async () => {
      const alice = await registerUser(ctx.app);

      const res = await refresh(alice.refreshToken);

      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({
        accessToken: expect.any(String),
        user: { ...alice.user, emailVerifiedAt: null },
      });
      const newToken = cookieValue(res, COOKIE)!;
      expect(newToken).not.toBe(alice.refreshToken);
      expect((await findRow(alice.refreshToken)).revokedAt).not.toBeNull();
      expect((await findRow(newToken)).revokedAt).toBeNull();
    });

    it('rejects a request without a refresh cookie', async () => {
      const res = await refresh();

      expect(res.statusCode).toBe(401);
      expect(res.json()).toMatchObject({ code: 'UNAUTHORIZED', message: 'Missing refresh token' });
    });

    it('rejects a garbage token', async () => {
      const res = await refresh('not-a-jwt');

      expect(res.statusCode).toBe(401);
    });

    it('rejects an access token sent as the refresh cookie', async () => {
      const alice = await registerUser(ctx.app);

      const res = await refresh(alice.accessToken);

      expect(res.statusCode).toBe(401);
    });

    it('rejects an expired JWT', async () => {
      const alice = await registerUser(ctx.app);
      vi.setSystemTime(Date.now() + 31 * DAY_MS);

      const res = await refresh(alice.refreshToken);

      expect(res.statusCode).toBe(401);
    });

    it('rejects a validly signed JWT that has no database record', async () => {
      const alice = await registerUser(ctx.app);
      await ctx.app.db.delete(refreshTokens);

      const res = await refresh(alice.refreshToken);

      expect(res.statusCode).toBe(401);
    });

    it('rejects a token that was already rotated (replay)', async () => {
      const alice = await registerUser(ctx.app);
      await refresh(alice.refreshToken);

      const replay = await refresh(alice.refreshToken);

      expect(replay.statusCode).toBe(401);
    });

    it('rejects a token whose database record has expired', async () => {
      const alice = await registerUser(ctx.app);
      await ctx.app.db
        .update(refreshTokens)
        .set({ expiresAt: new Date(Date.now() - 1000) })
        .where(eq(refreshTokens.tokenHash, hashToken(alice.refreshToken)));

      const res = await refresh(alice.refreshToken);

      expect(res.statusCode).toBe(401);
    });

    it('rejects the token of a user deactivated after it was issued', async () => {
      const alice = await registerUser(ctx.app);
      await ctx.app.db.update(users).set({ isActive: false }).where(eq(users.id, alice.user.id));

      const res = await refresh(alice.refreshToken);

      expect(res.statusCode).toBe(401);
    });

    it('refreshes within the same second the token was issued', async () => {
      vi.setSystemTime(new Date()); // freeze `Date` so both JWTs share the same `iat`
      const alice = await registerUser(ctx.app);

      const res = await refresh(alice.refreshToken);

      expect(res.statusCode).toBe(200);
      const newToken = cookieValue(res, COOKIE)!;
      expect(newToken).not.toBe(alice.refreshToken);
      expect((await refresh(newToken)).statusCode).toBe(200);
    });
  });

  describe('POST /auth/logout', () => {
    it('revokes the refresh token and clears the cookie', async () => {
      const alice = await registerUser(ctx.app);

      const res = await logout(alice.refreshToken);

      expect(res.statusCode).toBe(204);
      expect((await findRow(alice.refreshToken)).revokedAt).not.toBeNull();
      expect(res.cookies.find((c) => c.name === COOKIE)).toMatchObject({
        value: '',
        path: '/api/v1/auth',
      });
    });

    it('makes the refresh token unusable', async () => {
      const alice = await registerUser(ctx.app);
      await logout(alice.refreshToken);

      const res = await refresh(alice.refreshToken);

      expect(res.statusCode).toBe(401);
    });

    it('succeeds without a cookie', async () => {
      const res = await logout();

      expect(res.statusCode).toBe(204);
    });

    it('is idempotent', async () => {
      const alice = await registerUser(ctx.app);

      const first = await logout(alice.refreshToken);
      const second = await logout(alice.refreshToken);

      expect([first.statusCode, second.statusCode]).toEqual([204, 204]);
    });

    it('only revokes the session it was called for', async () => {
      const alice = await registerUser(ctx.app);
      const otherSession = await login(ctx.app, alice.email);

      await logout(alice.refreshToken);

      expect((await findRow(cookieValue(otherSession, COOKIE)!)).revokedAt).toBeNull();
    });
  });

  describe('GET /auth/me', () => {
    it('returns the current user', async () => {
      const alice = await registerUser(ctx.app);

      const res = await call(ctx.app, {
        method: 'GET',
        url: `${API}/auth/me`,
        headers: alice.headers,
      });

      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual(alice.user);
    });
  });
});
