import { and, eq, isNull } from 'drizzle-orm';
import { accounts, transactions } from '@compta/db';

import type { Database, DbTransaction, NewAccount } from '@compta/db';

export function buildAccountsRepository(db: Database['db']) {
  return {
    async createDefault(userId: string, executor: Database['db'] | DbTransaction = db) {
      const [account] = await executor
        .insert(accounts)
        .values({ userId, category: 'Personal' } satisfies NewAccount)
        .returning();

      return account;
    },

    async getAllAccountByUserId(userId: string) {
      return db.query.accounts.findMany({
        where: and(eq(accounts.userId, userId), eq(accounts.isActive, true)),
        columns: {
          id: true,
          category: true,
        },
      });
    },

    async createNewAccountByUserId(userId: string, category: string) {
      const [account] = await db.insert(accounts).values({ userId, category }).returning();

      return account;
    },

    /**
     * Soft-deletes an account and its transactions, unless it is the user's last active one.
     * Locks the user's active accounts (in id order) so concurrent deletes can't remove them all.
     */
    async softDeleteUnlessLast(id: string, userId: string) {
      return db.transaction(async (tx) => {
        // Lock all active accounts of the user, ordered by id to avoid deadlocks
        const activeAccounts = await tx
          .select({ id: accounts.id })
          .from(accounts)
          .where(and(eq(accounts.userId, userId), eq(accounts.isActive, true)))
          .orderBy(accounts.id)
          .for('update');

        if (!activeAccounts.some((account) => account.id === id)) return 'not_found';
        if (activeAccounts.length === 1) return 'last_account';

        // Soft-delete the transactions first, then the account
        const now = new Date();
        await tx
          .update(transactions)
          .set({ deletedAt: now })
          .where(and(eq(transactions.accountId, id), isNull(transactions.deletedAt)));
        await tx
          .update(accounts)
          .set({ isActive: false, deletedAt: now })
          .where(eq(accounts.id, id));

        return 'deleted';
      });
    },
  };
}
