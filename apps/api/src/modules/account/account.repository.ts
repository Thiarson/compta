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
  };
}
