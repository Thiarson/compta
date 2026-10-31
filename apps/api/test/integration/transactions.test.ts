import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { transactions } from '@compta/db';
import { setupTestApp } from '../helpers/app.js';
import { API, call, omit } from '../helpers/api.js';
import { registerUser } from '../helpers/auth.js';
import {
  buildTransactionPayload,
  createAccount,
  createTransaction,
  listAccounts,
} from '../helpers/data.js';

const NON_EXISTENT_ID = '00000000-0000-4000-8000-000000000000';

describe('transactions', () => {
  const ctx = setupTestApp();

  type Headers = Record<string, string>;
  const list = async (headers: Headers) =>
    (await call(ctx.app, { method: 'GET', url: `${API}/transactions`, headers })).json() as {
      id: string;
      date: string;
    }[];
  const create = (headers: Headers, payload: unknown) =>
    call(ctx.app, {
      method: 'POST',
      url: `${API}/transactions`,
      headers,
      payload: payload as object,
    });
  const remove = (headers: Headers, id: string) =>
    call(ctx.app, { method: 'DELETE', url: `${API}/transactions/${id}`, headers });

  /** A user with their default account, ready to add transactions. */
  async function aUser(username = 'alice') {
    const user = await registerUser(ctx.app, { username });
    const [account] = await listAccounts(ctx.app, user.headers);
    return { ...user, account };
  }

  describe('POST /transactions', () => {
    it.each(['income', 'expense'])('creates an %s transaction', async (type) => {
      const alice = await aUser();
      const payload = buildTransactionPayload(alice.account.id, { type });

      const res = await create(alice.headers, payload);

      expect(res.statusCode).toBe(201);
      expect(res.json()).toEqual({
        id: expect.any(String),
        accountId: alice.account.id,
        type,
        amount: payload.amount,
        description: payload.description,
        date: payload.date,
        createdAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T.+Z$/),
      });
    });

    it('persists the transaction', async () => {
      const alice = await aUser();

      const res = await create(alice.headers, buildTransactionPayload(alice.account.id));

      const [row] = await ctx.app.db
        .select()
        .from(transactions)
        .where(eq(transactions.id, res.json().id));
      expect(row).toMatchObject({ accountId: alice.account.id, deletedAt: null });
    });

    describe('validation', () => {
      it.each(['accountId', 'type', 'amount', 'description', 'date'])(
        'rejects a missing %s',
        async (field) => {
          const alice = await aUser();
          const res = await create(
            alice.headers,
            omit(buildTransactionPayload(alice.account.id), field),
          );

          expect(res.statusCode).toBe(400);
          expect(res.json().code).toBe('VALIDATION_ERROR');
        },
      );

      it.each([
        { name: 'an amount of 0', overrides: { amount: 0 } },
        { name: 'a negative amount', overrides: { amount: -5 } },
        { name: 'a non-numeric amount', overrides: { amount: 'abc' } },
        { name: 'an unknown type', overrides: { type: 'transfer' } },
        { name: 'a 1-character description', overrides: { description: 'a' } },
        { name: 'a 201-character description', overrides: { description: 'a'.repeat(201) } },
        { name: 'a non-uuid accountId', overrides: { accountId: 'abc' } },
        { name: 'a malformed date', overrides: { date: '15/01/2026' } },
        { name: 'a datetime instead of a date', overrides: { date: '2026-01-15T10:00:00Z' } },
        { name: 'an impossible date', overrides: { date: '2026-02-30' } },
      ])('rejects $name', async ({ overrides }) => {
        const alice = await aUser();

        const res = await create(
          alice.headers,
          buildTransactionPayload(alice.account.id, overrides),
        );

        expect(res.statusCode).toBe(400);
        expect(res.json().code).toBe('VALIDATION_ERROR');
      });

      it.each([2, 200])('accepts a description of %i characters', async (length) => {
        const alice = await aUser();

        const res = await create(
          alice.headers,
          buildTransactionPayload(alice.account.id, { description: 'a'.repeat(length) }),
        );

        expect(res.statusCode).toBe(201);
      });

      it('rejects a decimal amount with a clear message', async () => {
        const alice = await aUser();

        const res = await create(
          alice.headers,
          buildTransactionPayload(alice.account.id, { amount: 12.5 }),
        );

        expect(res.statusCode).toBe(400);
        expect(JSON.stringify(res.json().details)).toContain('Amount must be a whole number');
      });
    });

    describe('ownership', () => {
      it("answers 404 for another user's account and creates nothing", async () => {
        const alice = await aUser();
        const bob = await aUser('bob');

        const res = await create(alice.headers, buildTransactionPayload(bob.account.id));

        expect(res.statusCode).toBe(404);
        expect(await ctx.app.db.select().from(transactions)).toHaveLength(0);
      });

      it('answers 404 for an unknown account', async () => {
        const alice = await aUser();

        const res = await create(alice.headers, buildTransactionPayload(NON_EXISTENT_ID));

        expect(res.statusCode).toBe(404);
      });

      it('answers 404 for a deleted account', async () => {
        const alice = await aUser();
        const savings = await createAccount(ctx.app, alice.headers);
        await call(ctx.app, {
          method: 'DELETE',
          url: `${API}/accounts/${savings.id}`,
          headers: alice.headers,
        });

        const res = await create(alice.headers, buildTransactionPayload(savings.id));

        expect(res.statusCode).toBe(404);
      });
    });
  });

  describe('GET /transactions', () => {
    it('returns an empty list for a new user', async () => {
      const alice = await aUser();

      expect(await list(alice.headers)).toEqual([]);
    });

    it('returns transactions across all of the user’s accounts', async () => {
      const alice = await aUser();
      const savings = await createAccount(ctx.app, alice.headers);
      const a = await createTransaction(ctx.app, alice.headers, alice.account.id);
      const b = await createTransaction(ctx.app, alice.headers, savings.id);

      const ids = (await list(alice.headers)).map((t) => t.id);

      expect(ids).toHaveLength(2);
      expect(ids).toEqual(expect.arrayContaining([a.id, b.id]));
    });

    it("never includes other users' transactions", async () => {
      const alice = await aUser();
      const bob = await aUser('bob');
      await createTransaction(ctx.app, bob.headers, bob.account.id);

      expect(await list(alice.headers)).toEqual([]);
    });

    it('excludes soft-deleted transactions', async () => {
      const alice = await aUser();
      const deleted = await createTransaction(ctx.app, alice.headers, alice.account.id);
      const kept = await createTransaction(ctx.app, alice.headers, alice.account.id);
      await remove(alice.headers, deleted.id);

      expect((await list(alice.headers)).map((t) => t.id)).toEqual([kept.id]);
    });

    it('excludes the transactions of deleted accounts', async () => {
      const alice = await aUser();
      const savings = await createAccount(ctx.app, alice.headers);
      await createTransaction(ctx.app, alice.headers, savings.id);
      await call(ctx.app, {
        method: 'DELETE',
        url: `${API}/accounts/${savings.id}`,
        headers: alice.headers,
      });

      expect(await list(alice.headers)).toEqual([]);
    });

    it('orders by date descending, then most recently created first', async () => {
      const alice = await aUser();
      const make = (date: string) =>
        createTransaction(ctx.app, alice.headers, alice.account.id, { date });
      const oldest = await make('2026-01-01');
      const newest = await make('2026-03-01');
      const middleFirst = await make('2026-02-01');
      const middleSecond = await make('2026-02-01');

      const ids = (await list(alice.headers)).map((t) => t.id);

      expect(ids).toEqual([newest.id, middleSecond.id, middleFirst.id, oldest.id]);
    });
  });

  describe('DELETE /transactions/:id', () => {
    it('soft-deletes the transaction', async () => {
      const alice = await aUser();
      const transaction = await createTransaction(ctx.app, alice.headers, alice.account.id);

      const res = await remove(alice.headers, transaction.id);

      expect(res.statusCode).toBe(204);
      const [row] = await ctx.app.db
        .select()
        .from(transactions)
        .where(eq(transactions.id, transaction.id));
      expect(row.deletedAt).toBeInstanceOf(Date);
      expect(await list(alice.headers)).toEqual([]);
    });

    it('answers 404 when deleted a second time', async () => {
      const alice = await aUser();
      const transaction = await createTransaction(ctx.app, alice.headers, alice.account.id);
      await remove(alice.headers, transaction.id);

      expect((await remove(alice.headers, transaction.id)).statusCode).toBe(404);
    });

    it('answers 404 for an unknown id', async () => {
      const alice = await aUser();

      expect((await remove(alice.headers, NON_EXISTENT_ID)).statusCode).toBe(404);
    });

    it("answers 404 for another user's transaction and leaves it intact", async () => {
      const alice = await aUser();
      const bob = await aUser('bob');
      const bobTransaction = await createTransaction(ctx.app, bob.headers, bob.account.id);

      const res = await remove(alice.headers, bobTransaction.id);

      expect(res.statusCode).toBe(404);
      expect((await list(bob.headers)).map((t) => t.id)).toEqual([bobTransaction.id]);
    });

    it('rejects an id that is not a uuid', async () => {
      const alice = await aUser();

      const res = await remove(alice.headers, 'not-a-uuid');

      expect(res.statusCode).toBe(400);
    });
  });
});
