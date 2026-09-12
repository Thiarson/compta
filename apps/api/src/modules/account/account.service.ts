import { NotFoundError, ConflictError } from '../../utils/http-error.js';

import type { buildAccountsRepository } from './account.repository.js';

type AccountsRepository = ReturnType<typeof buildAccountsRepository>;

export function buildAccountsService(accountsRepository: AccountsRepository) {
  return {
    async getAllUserAccounts(userId: string) {
      return await accountsRepository.getAllAccountByUserId(userId);
    },

    async createNewAccount(userId: string, category: string) {
      return await accountsRepository.createNewAccountByUserId(userId, category);
    },

    async deleteAccount(userId: string, accountId: string) {
      const account = await accountsRepository.findActiveByIdAndUserId(accountId, userId);

      if (!account) {
        throw new NotFoundError('Account not found');
      }

      const activeCount = await accountsRepository.countActiveByUserId(userId);

      if (activeCount <= 1) {
        throw new ConflictError('Cannot delete your only account');
      }

      await accountsRepository.softDeleteById(accountId);
    },
  };
}
