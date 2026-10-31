import { eq } from 'drizzle-orm';
import { describe, expect, it, vi } from 'vitest';
import { refreshTokens, users } from '@compta/db';
import { setupTestApp } from '../../helpers/app.js';
import { API, call, cookieValue } from '../../helpers/api.js';
import { login, registerUser } from '../../helpers/auth.js';
import { hashToken } from '../../../src/utils/token.js';

describe('POST /auth/login', () => {
  const ctx = setupTestApp();

  it('returns an access token, the user and a refresh cookie', async () => {
    const alice = await registerUser(ctx.app);

    const res = await login(ctx.app, alice.email);

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      accessToken: expect.any(String),
      user: { ...alice.user, emailVerifiedAt: null },
    });
    expect(cookieValue(res, 'refreshToken')).toBeTruthy();
  });

  it('stores only the hash of the refresh token', async () => {
    const alice = await registerUser(ctx.app);

    const res = await login(ctx.app, alice.email);

    const refreshToken = cookieValue(res, 'refreshToken')!;
    const rows = await ctx.app.db
      .select()
      .from(refreshTokens)
      .where(eq(refreshTokens.tokenHash, hashToken(refreshToken)));
    expect(rows).toHaveLength(1);
    expect(rows[0].revokedAt).toBeNull();
  });

  describe('invalid credentials', () => {
    it.each([
      { name: 'a wrong password', email: (e: string) => e, password: 'wrong-password' },
      { name: 'an unknown email', email: () => 'nobody@test.dev', password: 'password123' },
    ])('rejects $name with a generic 401', async ({ email, password }) => {
      const alice = await registerUser(ctx.app);

      const res = await login(ctx.app, email(alice.email), password);

      expect(res.statusCode).toBe(401);
      expect(res.json()).toEqual({
        statusCode: 401,
        code: 'UNAUTHORIZED',
        message: 'Invalid email or password',
      });
      expect(cookieValue(res, 'refreshToken')).toBeUndefined();
    });

    it('rejects an inactive user with the same generic 401', async () => {
      const alice = await registerUser(ctx.app);
      await ctx.app.db.update(users).set({ isActive: false }).where(eq(users.id, alice.user.id));

      const res = await login(ctx.app, alice.email);

      expect(res.statusCode).toBe(401);
      expect(res.json().message).toBe('Invalid email or password');
    });
  });

  describe('validation', () => {
    it.each([
      { name: 'an invalid email', payload: { email: 'nope', password: 'password123' } },
      { name: 'a short password', payload: { email: 'a@test.dev', password: 'short' } },
      { name: 'a missing password', payload: { email: 'a@test.dev' } },
      { name: 'a missing email', payload: { password: 'password123' } },
    ])('rejects $name with 400', async ({ payload }) => {
      const res = await call(ctx.app, { method: 'POST', url: `${API}/auth/login`, payload });

      expect(res.statusCode).toBe(400);
      expect(res.json().code).toBe('VALIDATION_ERROR');
    });
  });

  it('issues a distinct refresh token on every login, even within the same second', async () => {
    vi.setSystemTime(new Date()); // freeze `Date` so both JWTs share the same `iat`
    const alice = await registerUser(ctx.app);

    const first = await login(ctx.app, alice.email);
    const second = await login(ctx.app, alice.email);

    expect(first.statusCode).toBe(200);
    expect(second.statusCode).toBe(200);
    expect(cookieValue(first, 'refreshToken')).not.toBe(cookieValue(second, 'refreshToken'));
  });

  it('matches the email regardless of case', async () => {
    const alice = await registerUser(ctx.app);

    const res = await login(ctx.app, alice.email.toUpperCase());

    expect(res.statusCode).toBe(200);
    expect(res.json().user.email).toBe(alice.email);
  });
});
