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
  };
}
