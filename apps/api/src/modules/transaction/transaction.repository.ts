import { and, eq, inArray, isNull } from 'drizzle-orm';
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
        where: and(
          isNull(transactions.deletedAt),
          inArray(
            transactions.accountId,
            db.select({ id: accounts.id }).from(accounts).where(eq(accounts.userId, userId)),
          ),
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

    async findByIdAndUserId(transactionId: string, userId: string) {
      return db.query.transactions.findFirst({
        where: and(
          eq(transactions.id, transactionId),
          isNull(transactions.deletedAt),
          inArray(
            transactions.accountId,
            db.select({ id: accounts.id }).from(accounts).where(eq(accounts.userId, userId)),
          ),
        ),
        columns: { id: true },
      });
    },

    async softDeleteById(transactionId: string) {
      await db
        .update(transactions)
        .set({ deletedAt: new Date() })
        .where(eq(transactions.id, transactionId));
    },
  };
}
