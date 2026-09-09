import { and, eq, inArray } from 'drizzle-orm';
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

    async getAllTransactionsByUserId(userId: string) {
      return db.query.transactions.findMany({
        where: inArray(
          transactions.accountId,
          db.select({ id: accounts.id }).from(accounts).where(eq(accounts.userId, userId)),
        ),
        orderBy: (t, { desc }) => [desc(t.date), desc(t.createdAt)],
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
