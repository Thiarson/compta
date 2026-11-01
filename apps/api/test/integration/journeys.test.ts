import { describe, expect, it } from 'vitest';
import { lastEmailToken, setupTestApp } from '../helpers/app.js';
import { API, bearer, call, cookieValue } from '../helpers/api.js';
import { buildRegisterPayload, login } from '../helpers/auth.js';

describe('user journeys', () => {
  const ctx = setupTestApp();

  const post = (path: string, options: object = {}) =>
    call(ctx.app, { method: 'POST', url: `${API}/auth/${path}`, ...options });
  const me = (accessToken: string) =>
    call(ctx.app, { method: 'GET', url: `${API}/auth/me`, headers: bearer(accessToken) });

  it('sign up → verify email → log in → refresh → log out', async () => {
    const credentials = buildRegisterPayload();

    const registered = await post('register', { payload: credentials });
    expect(registered.statusCode).toBe(201);

    const verified = await post('verify-email', {
      payload: { verificationToken: lastEmailToken(ctx.sendEmail) },
    });
    expect(verified.statusCode).toBe(204);

    const loggedIn = await login(ctx.app, credentials.email, credentials.password);
    expect(loggedIn.statusCode).toBe(200);
    expect(loggedIn.json().user.emailVerifiedAt).toEqual(expect.any(String));

    const refreshed = await post('refresh', {
      cookies: { refreshToken: cookieValue(loggedIn, 'refreshToken')! },
    });
    expect(refreshed.statusCode).toBe(200);
    expect((await me(refreshed.json().accessToken)).statusCode).toBe(200);

    const refreshToken = cookieValue(refreshed, 'refreshToken')!;
    expect((await post('logout', { cookies: { refreshToken } })).statusCode).toBe(204);
    expect((await post('refresh', { cookies: { refreshToken } })).statusCode).toBe(401);
  });

  it('forgot password → check link → reset → log in with the new password', async () => {
    const credentials = buildRegisterPayload();
    await post('register', { payload: credentials });

    expect(
      (await post('forgot-password', { payload: { email: credentials.email } })).statusCode,
    ).toBe(204);
    const passwordResetToken = lastEmailToken(ctx.sendEmail);

    expect(
      (await post('verify-password-reset', { payload: { passwordResetToken } })).statusCode,
    ).toBe(204);
    expect(
      (
        await post('reset-password', {
          payload: { passwordResetToken, newPassword: 'a-new-password' },
        })
      ).statusCode,
    ).toBe(204);

    expect((await login(ctx.app, credentials.email, 'a-new-password')).statusCode).toBe(200);
    expect((await login(ctx.app, credentials.email, credentials.password)).statusCode).toBe(401);
  });
});
