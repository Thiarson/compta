import type { AddTransactionBody } from '@compta/contracts';
import type { buildTransactionsRepository } from './transaction.repository.js';

type TransactionsRepository = ReturnType<typeof buildTransactionsRepository>;

export function buildTransactionsService(transactionsRepository: TransactionsRepository) {
  return {
    async getAllUserTransactions(userId: string) {
      return await transactionsRepository.getAllTransactionsByUserId(userId);
    },

    async createTransaction(userId: string, data: AddTransactionBody) {
      const account = await transactionsRepository.findAccountByIdAndUserId(data.accountId, userId);

      if (!account) {
        throw new Error('Account not found');
      }

      return await transactionsRepository.createTransaction(data);
    },
  };
}
