import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildTransactionsService } from '../../../../src/modules/transactions/transactions.service.js';
import { NotFoundError } from '../../../../src/utils/http-error.js';
import { buildTransaction } from '../../../helpers/fixtures.js';

import type { AddTransactionBody } from '@compta/contracts';
import type { buildTransactionsRepository } from '../../../../src/modules/transactions/transactions.repository.js';

type TransactionsRepository = ReturnType<typeof buildTransactionsRepository>;

const USER_ID = 'user-1';
const TRANSACTION_ID = 'transaction-1';

const newTransaction: AddTransactionBody = {
  accountId: 'account-1',
  type: 'expense',
  amount: 1000,
  description: 'Groceries',
  date: '2026-01-15',
};

describe('transactions.service', () => {
  const repository = {
    findAccountByIdAndUserId: vi.fn(),
    getAllTransactionsByUserId: vi.fn(),
    createTransaction: vi.fn(),
    findByIdAndUserId: vi.fn(),
    softDeleteById: vi.fn(),
  };
  const service = buildTransactionsService(repository as unknown as TransactionsRepository);

  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('createTransaction', () => {
    it('creates the transaction when the account belongs to the user', async () => {
      const created = buildTransaction(newTransaction);
      repository.findAccountByIdAndUserId.mockResolvedValue({ id: newTransaction.accountId });
      repository.createTransaction.mockResolvedValue(created);

      await expect(service.createTransaction(USER_ID, newTransaction)).resolves.toBe(created);
      expect(repository.findAccountByIdAndUserId).toHaveBeenCalledWith(
        newTransaction.accountId,
        USER_ID,
      );
      expect(repository.createTransaction).toHaveBeenCalledWith(newTransaction);
    });

    it('throws NotFoundError and inserts nothing when the account is not found for this user', async () => {
      repository.findAccountByIdAndUserId.mockResolvedValue(undefined);

      await expect(service.createTransaction(USER_ID, newTransaction)).rejects.toThrow(
        new NotFoundError('Account not found'),
      );
      expect(repository.createTransaction).not.toHaveBeenCalled();
    });
  });

  describe('deleteTransaction', () => {
    it('soft-deletes the transaction when it belongs to the user', async () => {
      repository.findByIdAndUserId.mockResolvedValue({ id: TRANSACTION_ID });

      await expect(service.deleteTransaction(USER_ID, TRANSACTION_ID)).resolves.toBeUndefined();
      expect(repository.findByIdAndUserId).toHaveBeenCalledWith(TRANSACTION_ID, USER_ID);
      expect(repository.softDeleteById).toHaveBeenCalledExactlyOnceWith(TRANSACTION_ID);
    });

    it('throws NotFoundError and deletes nothing when the transaction is not found', async () => {
      repository.findByIdAndUserId.mockResolvedValue(undefined);

      await expect(service.deleteTransaction(USER_ID, TRANSACTION_ID)).rejects.toThrow(
        new NotFoundError('Transaction not found'),
      );
      expect(repository.softDeleteById).not.toHaveBeenCalled();
    });
  });

  describe('getAllUserTransactions', () => {
    it("returns the repository's transactions for the user", async () => {
      const transactions = [buildTransaction()];
      repository.getAllTransactionsByUserId.mockResolvedValue(transactions);

      await expect(service.getAllUserTransactions(USER_ID)).resolves.toBe(transactions);
      expect(repository.getAllTransactionsByUserId).toHaveBeenCalledWith(USER_ID);
    });
  });
});
