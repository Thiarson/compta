import { describe, expect, it } from 'vitest';
import { users } from '@compta/db';
import { lastEmailToken, setupTestApp } from '../helpers/app.js';
import { API, call } from '../helpers/api.js';
import { buildRegisterPayload, registerUser } from '../helpers/auth.js';
import { createAccount, listAccounts } from '../helpers/data.js';

/** Status codes of responses sent at the same time, sorted so order doesn't matter. */
async function statusesOf(requests: Promise<{ statusCode: number }>[]) {
  return (await Promise.all(requests)).map((r) => r.statusCode).sort((a, b) => a - b);
}

describe('concurrent requests', () => {
  const ctx = setupTestApp();

  const post = (path: string, payload?: object, extra: object = {}) =>
    call(ctx.app, { method: 'POST', url: `${API}/auth/${path}`, payload, ...extra });

  it('registers one user when the same email signs up twice at once', async () => {
    const payload = buildRegisterPayload();

    const statuses = await statusesOf([post('register', payload), post('register', payload)]);

    expect(statuses).toEqual([201, 409]);
    expect(await ctx.app.db.select().from(users)).toHaveLength(1);
  });

  it('accepts a refresh token only once when it is used twice at once', async () => {
    const alice = await registerUser(ctx.app);
    const withCookie = { cookies: { refreshToken: alice.refreshToken } };

    const statuses = await statusesOf([
      post('refresh', undefined, withCookie),
      post('refresh', undefined, withCookie),
    ]);

    expect(statuses).toEqual([200, 401]);
  });

  it('consumes a verification token only once when it is used twice at once', async () => {
    await registerUser(ctx.app);
    const payload = { verificationToken: lastEmailToken(ctx.sendEmail) };

    const statuses = await statusesOf([
      post('verify-email', payload),
      post('verify-email', payload),
    ]);

    expect(statuses).toEqual([204, 400]);
  });

  it('consumes a password reset token only once when it is used twice at once', async () => {
    const alice = await registerUser(ctx.app);
    await post('forgot-password', { email: alice.email });
    const token = lastEmailToken(ctx.sendEmail);

    const statuses = await statusesOf([
      post('reset-password', { passwordResetToken: token, newPassword: 'first-password' }),
      post('reset-password', { passwordResetToken: token, newPassword: 'second-password' }),
    ]);

    expect(statuses).toEqual([204, 400]);
  });

  it('never deletes both accounts when the last two are deleted at once', async () => {
    const alice = await registerUser(ctx.app);
    const [personal] = await listAccounts(ctx.app, alice.headers);
    const savings = await createAccount(ctx.app, alice.headers);
    const remove = (id: string) =>
      call(ctx.app, { method: 'DELETE', url: `${API}/accounts/${id}`, headers: alice.headers });

    const statuses = await statusesOf([remove(personal.id), remove(savings.id)]);

    expect(statuses).toEqual([204, 409]);
    expect(await listAccounts(ctx.app, alice.headers)).toHaveLength(1);
  });
});
