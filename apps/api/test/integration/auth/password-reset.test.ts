import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { passwordResetTokens } from '@compta/db';
import { lastEmailToken, setupTestApp } from '../../helpers/app.js';
import { API, call, cookieValue } from '../../helpers/api.js';
import { login, registerUser } from '../../helpers/auth.js';
import { hashToken } from '../../../src/utils/token.js';

const NEW_PASSWORD = 'brand-new-password';

describe('password reset', () => {
  const ctx = setupTestApp();

  const post = (path: string, payload: object) =>
    call(ctx.app, { method: 'POST', url: `${API}/auth/${path}`, payload });
  const forgot = (email: string) => post('forgot-password', { email });
  const verifyReset = (token: string) =>
    post('verify-password-reset', { passwordResetToken: token });
  const reset = (token: string, newPassword = NEW_PASSWORD) =>
    post('reset-password', { passwordResetToken: token, newPassword });
  const tokenRow = async (token: string) =>
    (
      await ctx.app.db
        .select()
        .from(passwordResetTokens)
        .where(eq(passwordResetTokens.tokenHash, hashToken(token)))
    )[0];

  /** A registered user who has requested a reset; returns the emailed token. */
  async function requestReset() {
    const alice = await registerUser(ctx.app);
    ctx.sendEmail.mockClear();
    await forgot(alice.email);
    return { alice, token: lastEmailToken(ctx.sendEmail) };
  }

  async function expireToken(token: string) {
    await ctx.app.db
      .update(passwordResetTokens)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(passwordResetTokens.tokenHash, hashToken(token)));
  }

  describe('POST /auth/forgot-password', () => {
    it('emails a reset link and stores only the hash of its token', async () => {
      const alice = await registerUser(ctx.app);
      ctx.sendEmail.mockClear();

      const res = await forgot(alice.email);

      expect(res.statusCode).toBe(204);
      expect(ctx.sendEmail).toHaveBeenCalledExactlyOnceWith(
        alice.email,
        expect.any(String),
        expect.stringContaining('/reset-password?token='),
        expect.stringMatching(/^reset-password-[0-9a-f-]{36}$/), // job id: template + token row uuid
      );
      const row = await tokenRow(lastEmailToken(ctx.sendEmail));
      expect(row).toMatchObject({ userId: alice.user.id, usedAt: null, invalidatedAt: null });
    });

    it('finds the account regardless of the email casing', async () => {
      const alice = await registerUser(ctx.app);
      ctx.sendEmail.mockClear();

      await forgot(alice.email.toUpperCase());

      expect(ctx.sendEmail).toHaveBeenCalledExactlyOnceWith(
        alice.email,
        expect.any(String),
        expect.any(String),
        expect.stringMatching(/^reset-password-[0-9a-f-]{36}$/), // job id: template + token row uuid
      );
    });

    it('escapes the username in the email HTML', async () => {
      const alice = await registerUser(ctx.app, { username: '<b>alice</b>' });
      ctx.sendEmail.mockClear();

      await forgot(alice.email);

      expect(ctx.sendEmail.mock.lastCall![2]).toContain('Hi &lt;b&gt;alice&lt;/b&gt;,');
    });

    it('answers an unknown email exactly like a known one, without sending anything', async () => {
      const alice = await registerUser(ctx.app);
      const known = await forgot(alice.email);
      ctx.sendEmail.mockClear();

      const unknown = await forgot('nobody@test.dev');

      expect(unknown.statusCode).toBe(known.statusCode);
      expect(unknown.body).toBe(known.body);
      expect(ctx.sendEmail).not.toHaveBeenCalled();
    });

    it('invalidates the previous token when a new reset is requested', async () => {
      const { alice, token: firstToken } = await requestReset();

      await forgot(alice.email);

      expect((await tokenRow(firstToken)).invalidatedAt).not.toBeNull();
      expect((await reset(firstToken)).statusCode).toBe(400);
      expect((await reset(lastEmailToken(ctx.sendEmail))).statusCode).toBe(204);
    });
  });

  describe('POST /auth/verify-password-reset', () => {
    it('accepts a valid token without consuming it', async () => {
      const { token } = await requestReset();

      const first = await verifyReset(token);
      const second = await verifyReset(token);

      expect([first.statusCode, second.statusCode]).toEqual([204, 204]);
      expect((await tokenRow(token)).usedAt).toBeNull();
    });

    it('rejects an unknown token', async () => {
      expect((await verifyReset('f'.repeat(64))).statusCode).toBe(400);
    });

    it('rejects a used token', async () => {
      const { token } = await requestReset();
      await reset(token);

      expect((await verifyReset(token)).statusCode).toBe(400);
    });

    it('rejects an expired token', async () => {
      const { token } = await requestReset();
      await expireToken(token);

      expect((await verifyReset(token)).statusCode).toBe(400);
    });
  });

  describe('POST /auth/reset-password', () => {
    it('changes the password: the new one logs in and the old one no longer does', async () => {
      const { alice, token } = await requestReset();

      const res = await reset(token);

      expect(res.statusCode).toBe(204);
      expect((await login(ctx.app, alice.email, NEW_PASSWORD)).statusCode).toBe(200);
      expect((await login(ctx.app, alice.email, alice.password)).statusCode).toBe(401);
    });

    it('ends every existing session', async () => {
      const { alice, token } = await requestReset();
      const otherSession = await login(ctx.app, alice.email, alice.password);
      const otherRefreshToken = cookieValue(otherSession, 'refreshToken')!;

      await reset(token);

      for (const refreshToken of [alice.refreshToken, otherRefreshToken]) {
        const res = await call(ctx.app, {
          method: 'POST',
          url: `${API}/auth/refresh`,
          cookies: { refreshToken },
        });
        expect(res.statusCode).toBe(401);
      }
    });

    it('can only be used once', async () => {
      const { token } = await requestReset();
      await reset(token);

      const second = await reset(token, 'another-password');

      expect(second.statusCode).toBe(400);
      expect(second.json().message).toBe('Invalid or expired password reset token');
    });

    it('rejects an expired token and leaves the password unchanged', async () => {
      const { alice, token } = await requestReset();
      await expireToken(token);

      const res = await reset(token);

      expect(res.statusCode).toBe(400);
      expect((await login(ctx.app, alice.email, alice.password)).statusCode).toBe(200);
    });

    it('rejects an unknown token', async () => {
      expect((await reset('f'.repeat(64))).statusCode).toBe(400);
    });

    it('rejects a new password shorter than 8 characters and keeps the token usable', async () => {
      const { token } = await requestReset();

      const res = await reset(token, 'short');

      expect(res.statusCode).toBe(400);
      expect(res.json().code).toBe('VALIDATION_ERROR');
      expect((await reset(token)).statusCode).toBe(204);
    });
  });
});
