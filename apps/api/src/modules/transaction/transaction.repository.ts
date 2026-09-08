import { and, eq } from 'drizzle-orm';
import { accounts, transactions } from '@compta/db';

import type { Database, NewTransaction } from '@compta/db';
import type { AddTransactionBody } from '@compta/contracts';

export function buildTransactionsRepository(db: Database['db']) {
  return {
    async findAccountByIdAndUserId(accountId: string, userId: string) {
      return db.query.accounts.findFirst({
        where: and(
          eq(accounts.id, accountId),
          eq(accounts.userId, userId),
          eq(accounts.isActive, true),
        ),
        columns: { id: true },
      });
    },

    async createTransaction(data: AddTransactionBody) {
      const [transaction] = await db
        .insert(transactions)
        .values(data satisfies NewTransaction)
        .returning();

      return transaction;
    },
  };
}
