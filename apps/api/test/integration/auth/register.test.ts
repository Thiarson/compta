import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { accounts, emailVerificationTokens, users } from '@compta/db';
import { lastEmailToken, setupTestApp } from '../../helpers/app.js';
import { API, call, cookieValue, omit } from '../../helpers/api.js';
import { buildRegisterPayload } from '../../helpers/auth.js';
import { failWritesTo } from '../../helpers/db.js';
import { hashToken } from '../../../src/utils/token.js';

describe('POST /auth/register', () => {
  const ctx = setupTestApp();

  const register = (payload: unknown) =>
    call(ctx.app, { method: 'POST', url: `${API}/auth/register`, payload: payload as object });

  it('creates the user and returns an access token', async () => {
    const payload = buildRegisterPayload();

    const res = await register(payload);

    expect(res.statusCode).toBe(201);
    expect(res.json()).toEqual({
      accessToken: expect.any(String),
      user: {
        id: expect.any(String),
        username: payload.username,
        email: payload.email,
        emailVerifiedAt: null,
      },
    });
  });

  it('sets the refresh token as an HttpOnly, strict, path-scoped cookie', async () => {
    const res = await register(buildRegisterPayload());

    const cookie = res.cookies.find((c) => c.name === 'refreshToken');
    expect(cookie).toMatchObject({
      httpOnly: true,
      sameSite: 'Strict',
      path: '/api/v1/auth',
      maxAge: 30 * 24 * 3600,
    });
    expect(cookieValue(res, 'refreshToken')).toBeTruthy();
  });

  it('creates a default Personal account for the user', async () => {
    const res = await register(buildRegisterPayload());

    const rows = await ctx.app.db.query.accounts.findMany({
      where: eq(accounts.userId, res.json().user.id),
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ category: 'Personal', isActive: true });
  });

  it('never exposes the password hash and stores an argon2 hash, not the password', async () => {
    const payload = buildRegisterPayload();

    const res = await register(payload);

    expect(res.body).not.toContain('passwordHash');
    expect(res.body).not.toContain(payload.password);
    const [row] = await ctx.app.db.select().from(users).where(eq(users.email, payload.email));
    expect(row.passwordHash).toMatch(/^\$argon2id\$/);
    expect(row.passwordHash).not.toContain(payload.password);
  });

  it('emails a verification link and stores only the hash of its token', async () => {
    const payload = buildRegisterPayload();

    const res = await register(payload);

    expect(ctx.sendEmail).toHaveBeenCalledExactlyOnceWith(
      payload.email,
      expect.any(String),
      expect.stringContaining('/verify-email?token='),
      expect.stringMatching(/^verify-email-[0-9a-f-]{36}$/), // job id: template + token row uuid
    );
    const token = lastEmailToken(ctx.sendEmail);
    const [row] = await ctx.app.db
      .select()
      .from(emailVerificationTokens)
      .where(eq(emailVerificationTokens.userId, res.json().user.id));
    expect(row.tokenHash).toBe(hashToken(token));
    expect(row.tokenHash).not.toBe(token);
  });

  it('rejects an email that is already registered with 409', async () => {
    const payload = buildRegisterPayload();
    await register(payload);

    const res = await register({ ...payload, username: 'someone-else' });

    expect(res.statusCode).toBe(409);
    expect(res.json()).toMatchObject({ code: 'CONFLICT', message: 'Email already in use' });
  });

  it('treats an email differing only by case as already registered', async () => {
    const payload = buildRegisterPayload({ email: 'Alice@Test.dev' });
    await register(payload);

    const res = await register({ ...payload, email: 'alice@test.dev' });

    expect(res.statusCode).toBe(409);
  });

  it('stores the email lower-cased', async () => {
    const res = await register(buildRegisterPayload({ email: 'Alice@Test.DEV' }));

    expect(res.statusCode).toBe(201);
    expect(res.json().user.email).toBe('alice@test.dev');
    const [row] = await ctx.app.db.select().from(users);
    expect(row.email).toBe('alice@test.dev');
  });

  it('creates no user when the default account cannot be created', async () => {
    await failWritesTo(ctx.app, 'accounts', 'INSERT');

    const res = await register(buildRegisterPayload());

    expect(res.statusCode).toBe(500);
    await expect(ctx.app.db.select().from(users)).resolves.toHaveLength(0);
  });

  it('stores the username as typed but escapes it in the email HTML', async () => {
    const username = '<a href="https://evil.example">Win</a>';

    const res = await register(buildRegisterPayload({ username }));

    expect(res.json().user.username).toBe(username);
    const emailBody = ctx.sendEmail.mock.lastCall![2];
    expect(emailBody).toContain('Hi &lt;a href=&quot;https://evil.example&quot;&gt;Win&lt;/a&gt;,');
    expect(emailBody).not.toContain('<a href="https://evil.example">');
  });

  describe('validation', () => {
    it.each([
      { field: 'username', message: 'Username is required' },
      { field: 'email', message: 'Email is required' },
      { field: 'password', message: 'Password is required' },
    ])('rejects a missing $field', async ({ field, message }) => {
      const res = await register(omit(buildRegisterPayload(), field));

      expect(res.statusCode).toBe(400);
      expect(res.json()).toMatchObject({ code: 'VALIDATION_ERROR' });
      expect(JSON.stringify(res.json().details)).toContain(message);
    });

    it('rejects an empty body', async () => {
      const res = await register({});

      expect(res.statusCode).toBe(400);
    });

    it.each([
      { name: 'a 1-character username', overrides: { username: 'a' } },
      { name: 'an invalid email', overrides: { email: 'not-an-email' } },
      { name: 'a 7-character password', overrides: { password: 'a'.repeat(7) } },
    ])('rejects $name', async ({ overrides }) => {
      const res = await register(buildRegisterPayload(overrides));

      expect(res.statusCode).toBe(400);
      expect(res.json().code).toBe('VALIDATION_ERROR');
    });

    it.each([
      { name: 'a 2-character username', overrides: { username: 'ab' } },
      { name: 'an 8-character password', overrides: { password: 'a'.repeat(8) } },
    ])('accepts $name', async ({ overrides }) => {
      const res = await register(buildRegisterPayload(overrides));

      expect(res.statusCode).toBe(201);
    });

    it('does not create a user when validation fails', async () => {
      await register(buildRegisterPayload({ password: 'short' }));

      await expect(ctx.app.db.select().from(users)).resolves.toHaveLength(0);
    });
  });
});
