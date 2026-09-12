import { NotFoundError } from '../../utils/http-error.js';

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
        throw new NotFoundError('Account not found');
      }

      return await transactionsRepository.createTransaction(data);
    },

    async deleteTransaction(userId: string, transactionId: string) {
      const transaction = await transactionsRepository.findByIdAndUserId(transactionId, userId);

      if (!transaction) {
        throw new NotFoundError('Transaction not found');
      }

      await transactionsRepository.softDeleteById(transactionId);
    },
  };
}
