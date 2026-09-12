import { and, eq } from 'drizzle-orm';
import { accounts } from '@compta/db';

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

    async findActiveByIdAndUserId(id: string, userId: string) {
      return db.query.accounts.findFirst({
        where: and(eq(accounts.id, id), eq(accounts.userId, userId), eq(accounts.isActive, true)),
        columns: { id: true },
      });
    },

    async countActiveByUserId(userId: string) {
      const activeAccounts = await db.query.accounts.findMany({
        where: and(eq(accounts.userId, userId), eq(accounts.isActive, true)),
        columns: { id: true },
      });

      return activeAccounts.length;
    },

    async softDeleteById(id: string) {
      await db
        .update(accounts)
        .set({ isActive: false, deletedAt: new Date() })
        .where(eq(accounts.id, id));
    },
  };
}
