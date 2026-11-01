import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { emailVerificationTokens } from '@compta/db';
import { lastEmailToken, setupTestApp } from '../../helpers/app.js';
import { API, call } from '../../helpers/api.js';
import { registerUser } from '../../helpers/auth.js';
import { hashToken } from '../../../src/utils/token.js';

describe('email verification', () => {
  const ctx = setupTestApp();

  const resend = (headers?: Record<string, string>) =>
    call(ctx.app, { method: 'POST', url: `${API}/auth/resend-verification`, headers });
  const verify = (payload: unknown) =>
    call(ctx.app, {
      method: 'POST',
      url: `${API}/auth/verify-email`,
      payload: payload as object,
    });
  const tokenRow = async (token: string) =>
    (
      await ctx.app.db
        .select()
        .from(emailVerificationTokens)
        .where(eq(emailVerificationTokens.tokenHash, hashToken(token)))
    )[0];

  /** Registers a user and returns it with the token from its welcome email. */
  async function registerWithToken() {
    const alice = await registerUser(ctx.app);
    return { alice, token: lastEmailToken(ctx.sendEmail) };
  }

  describe('POST /auth/verify-email', () => {
    it('verifies the email and consumes the token', async () => {
      const { alice, token } = await registerWithToken();

      const res = await verify({ verificationToken: token });

      expect(res.statusCode).toBe(204);
      expect((await tokenRow(token)).usedAt).not.toBeNull();
      const me = await call(ctx.app, {
        method: 'GET',
        url: `${API}/auth/me`,
        headers: alice.headers,
      });
      expect(me.json().emailVerifiedAt).toEqual(expect.any(String));
    });

    it('rejects a token that was already used', async () => {
      const { token } = await registerWithToken();
      await verify({ verificationToken: token });

      const res = await verify({ verificationToken: token });

      expect(res.statusCode).toBe(400);
      expect(res.json()).toMatchObject({ message: 'Invalid or expired verification token' });
    });

    it('rejects an unknown token', async () => {
      const res = await verify({ verificationToken: 'f'.repeat(64) });

      expect(res.statusCode).toBe(400);
    });

    it('rejects an expired token', async () => {
      const { token } = await registerWithToken();
      await ctx.app.db
        .update(emailVerificationTokens)
        .set({ expiresAt: new Date(Date.now() - 1000) })
        .where(eq(emailVerificationTokens.tokenHash, hashToken(token)));

      const res = await verify({ verificationToken: token });

      expect(res.statusCode).toBe(400);
    });

    it('rejects a token invalidated by a newer one', async () => {
      const { alice, token: oldToken } = await registerWithToken();
      await resend(alice.headers);

      const res = await verify({ verificationToken: oldToken });

      expect(res.statusCode).toBe(400);
    });

    it('rejects a missing token field', async () => {
      const res = await verify({});

      expect(res.statusCode).toBe(400);
      expect(res.json().code).toBe('VALIDATION_ERROR');
    });
  });

  describe('POST /auth/resend-verification', () => {
    it('sends a new email whose token replaces the previous one', async () => {
      const { alice, token: oldToken } = await registerWithToken();
      ctx.sendEmail.mockClear();

      const res = await resend(alice.headers);

      expect(res.statusCode).toBe(202);
      expect(ctx.sendEmail).toHaveBeenCalledExactlyOnceWith(
        alice.email,
        expect.any(String),
        expect.stringContaining('/verify-email?token='),
      );
      const newToken = lastEmailToken(ctx.sendEmail);
      expect(newToken).not.toBe(oldToken);
      expect((await tokenRow(oldToken)).invalidatedAt).not.toBeNull();
      expect((await verify({ verificationToken: newToken })).statusCode).toBe(204);
    });

    it('rejects an already verified email with 409', async () => {
      const { alice, token } = await registerWithToken();
      await verify({ verificationToken: token });

      const res = await resend(alice.headers);

      expect(res.statusCode).toBe(409);
      expect(res.json()).toMatchObject({ code: 'CONFLICT', message: 'Email already verified' });
    });

    it('requires authentication', async () => {
      const res = await resend();

      expect(res.statusCode).toBe(401);
    });
  });
});
