import { describe, expect, it, vi } from 'vitest';
import { setupTestApp } from '../helpers/app.js';
import { API, call } from '../helpers/api.js';
import { registerUser } from '../helpers/auth.js';
import {
  buildTransactionPayload,
  createAccount,
  createTransaction,
  listAccounts,
} from '../helpers/data.js';

const SOME_ID = '00000000-0000-4000-8000-000000000000';

/** Every route that requires an access token, with a valid body so validation can't win. */
const PROTECTED_ROUTES = [
  { method: 'GET', url: `${API}/auth/me` },
  { method: 'POST', url: `${API}/auth/resend-verification` },
  { method: 'GET', url: `${API}/accounts` },
  { method: 'POST', url: `${API}/accounts`, payload: { category: 'Savings' } },
  { method: 'DELETE', url: `${API}/accounts/${SOME_ID}` },
  { method: 'GET', url: `${API}/transactions` },
  { method: 'POST', url: `${API}/transactions`, payload: buildTransactionPayload(SOME_ID) },
  { method: 'DELETE', url: `${API}/transactions/${SOME_ID}` },
] as const;

describe('security', () => {
  const ctx = setupTestApp();

  describe('authentication on protected routes', () => {
    const attempt = (route: (typeof PROTECTED_ROUTES)[number], headers?: Record<string, string>) =>
      call(ctx.app, {
        method: route.method,
        url: route.url,
        headers,
        payload: 'payload' in route ? route.payload : undefined,
      });

    function expectUnauthorized(res: Awaited<ReturnType<typeof attempt>>) {
      expect(res.statusCode).toBe(401);
      expect(res.json()).toEqual({
        statusCode: 401,
        code: 'UNAUTHORIZED',
        message: expect.any(String),
      });
    }

    describe.each(PROTECTED_ROUTES)('$method $url', (route) => {
      it('rejects a request without an Authorization header', async () => {
        expectUnauthorized(await attempt(route));
      });

      it.each([
        { name: 'a Bearer scheme without a token', value: 'Bearer' },
        { name: 'a non-Bearer scheme', value: 'Basic dXNlcjpwYXNz' },
        { name: 'a garbage token', value: 'Bearer not.a.jwt' },
      ])('rejects $name', async ({ value }) => {
        expectUnauthorized(await attempt(route, { authorization: value }));
      });

      it('rejects a token with a tampered signature', async () => {
        const alice = await registerUser(ctx.app);
        const tampered = `${alice.accessToken.slice(0, -3)}abc`;

        expectUnauthorized(await attempt(route, { authorization: `Bearer ${tampered}` }));
      });

      it('rejects an expired token', async () => {
        const alice = await registerUser(ctx.app);
        vi.setSystemTime(Date.now() + 31 * 24 * 3600 * 1000);

        expectUnauthorized(await attempt(route, alice.headers));
      });

      it('rejects a refresh token sent as the access token', async () => {
        const alice = await registerUser(ctx.app);

        expectUnauthorized(await attempt(route, { authorization: `Bearer ${alice.refreshToken}` }));
      });
    });
  });

  describe('tenant isolation', () => {
    it("never lets one user read or change another user's data", async () => {
      const alice = await registerUser(ctx.app);
      const bob = await registerUser(ctx.app, { username: 'bob' });
      const [bobPersonal] = await listAccounts(ctx.app, bob.headers);
      const bobSavings = await createAccount(ctx.app, bob.headers);
      const bobTransaction = await createTransaction(ctx.app, bob.headers, bobPersonal.id);

      const [accountsList, transactionsList, deleteAccount, deleteTransaction, createInBobs] =
        await Promise.all([
          call(ctx.app, { method: 'GET', url: `${API}/accounts`, headers: alice.headers }),
          call(ctx.app, { method: 'GET', url: `${API}/transactions`, headers: alice.headers }),
          call(ctx.app, {
            method: 'DELETE',
            url: `${API}/accounts/${bobSavings.id}`,
            headers: alice.headers,
          }),
          call(ctx.app, {
            method: 'DELETE',
            url: `${API}/transactions/${bobTransaction.id}`,
            headers: alice.headers,
          }),
          call(ctx.app, {
            method: 'POST',
            url: `${API}/transactions`,
            headers: alice.headers,
            payload: buildTransactionPayload(bobPersonal.id),
          }),
        ]);

      expect(accountsList.json()).toHaveLength(1);
      expect(accountsList.body).not.toContain(bobPersonal.id);
      expect(transactionsList.json()).toEqual([]);
      expect([deleteAccount, deleteTransaction, createInBobs].map((r) => r.statusCode)).toEqual([
        404, 404, 404,
      ]);
      // Bob's data is untouched
      expect(await listAccounts(ctx.app, bob.headers)).toHaveLength(2);
      const bobTransactions = await call(ctx.app, {
        method: 'GET',
        url: `${API}/transactions`,
        headers: bob.headers,
      });
      expect(bobTransactions.json()).toHaveLength(1);
    });
  });

  describe('error responses', () => {
    const expectErrorShape = (body: unknown) =>
      expect(body).toMatchObject({
        statusCode: expect.any(Number),
        code: expect.any(String),
        message: expect.any(String),
      });

    it('answers unknown routes with a 404 in the standard shape', async () => {
      const res = await call(ctx.app, { method: 'GET', url: `${API}/nope` });

      expect(res.statusCode).toBe(404);
      expect(res.json()).toMatchObject({ code: 'NOT_FOUND' });
      expectErrorShape(res.json());
    });

    it('answers a malformed JSON body with a 400 in the standard shape', async () => {
      const res = await call(ctx.app, {
        method: 'POST',
        url: `${API}/auth/login`,
        headers: { 'content-type': 'application/json' },
        payload: '{"email": ',
      });

      expect(res.statusCode).toBe(400);
      expect(res.json().code).toBe('BAD_REQUEST');
      expectErrorShape(res.json());
    });

    it('rejects a non-JSON body with a 400 in the standard shape', async () => {
      const res = await call(ctx.app, {
        method: 'POST',
        url: `${API}/auth/login`,
        headers: { 'content-type': 'text/plain' },
        payload: 'email=a@test.dev',
      });

      expect(res.statusCode).toBe(400);
      expect(res.json().code).toBe('VALIDATION_ERROR');
      expectErrorShape(res.json());
    });

    it('answers an oversized body with 413 in the standard shape', async () => {
      const res = await call(ctx.app, {
        method: 'POST',
        url: `${API}/auth/login`,
        payload: { email: 'a@test.dev', password: 'x'.repeat(2 * 1024 * 1024) },
      });

      expect(res.statusCode).toBe(413);
      expectErrorShape(res.json());
    });

    it('reports validation failures in the standard shape with details', async () => {
      const res = await call(ctx.app, {
        method: 'POST',
        url: `${API}/auth/login`,
        payload: {},
      });

      expect(res.statusCode).toBe(400);
      expect(res.json()).toMatchObject({ code: 'VALIDATION_ERROR', details: expect.any(Array) });
    });
  });
});
