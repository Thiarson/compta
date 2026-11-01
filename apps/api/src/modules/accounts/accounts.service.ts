import { NotFoundError, ConflictError } from '../../utils/http-error.js';

import type { buildAccountsRepository } from './accounts.repository.js';

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
      const result = await accountsRepository.softDeleteUnlessLast(accountId, userId);

      if (result === 'not_found') {
        throw new NotFoundError('Account not found');
      }

      if (result === 'last_account') {
        throw new ConflictError('Cannot delete your only account');
      }
    },
  };
}
