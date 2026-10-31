import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { accounts, transactions } from '@compta/db';
import { setupTestApp } from '../helpers/app.js';
import { API, call } from '../helpers/api.js';
import { registerUser } from '../helpers/auth.js';
import { createAccount, createTransaction, listAccounts } from '../helpers/data.js';

const NON_EXISTENT_ID = '00000000-0000-4000-8000-000000000000';

describe('accounts', () => {
  const ctx = setupTestApp();

  const create = (headers: Record<string, string>, payload: unknown) =>
    call(ctx.app, { method: 'POST', url: `${API}/accounts`, headers, payload: payload as object });
  const remove = (headers: Record<string, string>, id: string) =>
    call(ctx.app, { method: 'DELETE', url: `${API}/accounts/${id}`, headers });

  describe('GET /accounts', () => {
    it('lists the default account of a new user as { id, category }', async () => {
      const alice = await registerUser(ctx.app);

      const res = await call(ctx.app, {
        method: 'GET',
        url: `${API}/accounts`,
        headers: alice.headers,
      });

      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual([{ id: expect.any(String), category: 'Personal' }]);
    });

    it("never includes other users' accounts", async () => {
      const alice = await registerUser(ctx.app);
      const bob = await registerUser(ctx.app, { username: 'bob' });
      const bobSavings = await createAccount(ctx.app, bob.headers, 'Bob savings');

      const aliceAccounts = await listAccounts(ctx.app, alice.headers);

      expect(aliceAccounts.map((a) => a.id)).not.toContain(bobSavings.id);
      expect(aliceAccounts).toHaveLength(1);
    });

    it('excludes deleted accounts', async () => {
      const alice = await registerUser(ctx.app);
      const savings = await createAccount(ctx.app, alice.headers);
      await remove(alice.headers, savings.id);

      const list = await listAccounts(ctx.app, alice.headers);

      expect(list.map((a) => a.id)).not.toContain(savings.id);
    });
  });

  describe('POST /accounts', () => {
    it('creates an account for the current user', async () => {
      const alice = await registerUser(ctx.app);

      const res = await create(alice.headers, { category: 'Savings' });

      expect(res.statusCode).toBe(201);
      expect(res.json()).toEqual({ id: expect.any(String), category: 'Savings' });
      const [row] = await ctx.app.db.select().from(accounts).where(eq(accounts.id, res.json().id));
      expect(row).toMatchObject({ userId: alice.user.id, isActive: true, deletedAt: null });
    });

    it.each([2, 50])('accepts a category of %i characters', async (length) => {
      const alice = await registerUser(ctx.app);

      const res = await create(alice.headers, { category: 'a'.repeat(length) });

      expect(res.statusCode).toBe(201);
    });

    it.each([
      { name: 'a 1-character category', payload: { category: 'a' } },
      { name: 'a 51-character category', payload: { category: 'a'.repeat(51) } },
      { name: 'a missing category', payload: {} },
      { name: 'an object as category', payload: { category: { name: 'Savings' } } },
    ])('rejects $name', async ({ payload }) => {
      const alice = await registerUser(ctx.app);

      const res = await create(alice.headers, payload);

      expect(res.statusCode).toBe(400);
      expect(res.json().code).toBe('VALIDATION_ERROR');
    });
  });

  describe('DELETE /accounts/:id', () => {
    it('soft-deletes the account and all its transactions', async () => {
      const alice = await registerUser(ctx.app);
      const savings = await createAccount(ctx.app, alice.headers);
      const transaction = await createTransaction(ctx.app, alice.headers, savings.id);

      const res = await remove(alice.headers, savings.id);

      expect(res.statusCode).toBe(204);
      const [account] = await ctx.app.db.select().from(accounts).where(eq(accounts.id, savings.id));
      expect(account).toMatchObject({ isActive: false, deletedAt: expect.any(Date) });
      const [row] = await ctx.app.db
        .select()
        .from(transactions)
        .where(eq(transactions.id, transaction.id));
      expect(row.deletedAt).toBeInstanceOf(Date);
    });

    it('does not touch the transactions of the other accounts', async () => {
      const alice = await registerUser(ctx.app);
      const [personal] = await listAccounts(ctx.app, alice.headers);
      const savings = await createAccount(ctx.app, alice.headers);
      const kept = await createTransaction(ctx.app, alice.headers, personal.id);

      await remove(alice.headers, savings.id);

      const [row] = await ctx.app.db
        .select()
        .from(transactions)
        .where(eq(transactions.id, kept.id));
      expect(row.deletedAt).toBeNull();
    });

    it('refuses to delete the only account with 409', async () => {
      const alice = await registerUser(ctx.app);
      const [only] = await listAccounts(ctx.app, alice.headers);

      const res = await remove(alice.headers, only.id);

      expect(res.statusCode).toBe(409);
      expect(res.json()).toMatchObject({
        code: 'CONFLICT',
        message: 'Cannot delete your only account',
      });
      expect(await listAccounts(ctx.app, alice.headers)).toHaveLength(1);
    });

    it('answers 404 for an unknown id', async () => {
      const alice = await registerUser(ctx.app);

      const res = await remove(alice.headers, NON_EXISTENT_ID);

      expect(res.statusCode).toBe(404);
    });

    it("answers 404 for another user's account and leaves it intact", async () => {
      const alice = await registerUser(ctx.app);
      const bob = await registerUser(ctx.app, { username: 'bob' });
      const bobSavings = await createAccount(ctx.app, bob.headers);

      const res = await remove(alice.headers, bobSavings.id);

      expect(res.statusCode).toBe(404);
      expect((await listAccounts(ctx.app, bob.headers)).map((a) => a.id)).toContain(bobSavings.id);
    });

    it('answers 404 for an already deleted account', async () => {
      const alice = await registerUser(ctx.app);
      const savings = await createAccount(ctx.app, alice.headers);
      await remove(alice.headers, savings.id);

      const res = await remove(alice.headers, savings.id);

      expect(res.statusCode).toBe(404);
    });

    it('rejects an id that is not a uuid', async () => {
      const alice = await registerUser(ctx.app);

      const res = await remove(alice.headers, 'not-a-uuid');

      expect(res.statusCode).toBe(400);
      expect(res.json().code).toBe('VALIDATION_ERROR');
    });
  });
});
