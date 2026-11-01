import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildAccountsService } from '../../../../src/modules/accounts/accounts.service.js';
import { ConflictError, NotFoundError } from '../../../../src/utils/http-error.js';

import type { buildAccountsRepository } from '../../../../src/modules/accounts/accounts.repository.js';

type AccountsRepository = ReturnType<typeof buildAccountsRepository>;

const USER_ID = 'user-1';
const ACCOUNT_ID = 'account-1';

describe('accounts.service', () => {
  const repository = {
    getAllAccountByUserId: vi.fn(),
    createNewAccountByUserId: vi.fn(),
    softDeleteUnlessLast: vi.fn(),
  };
  const service = buildAccountsService(repository as unknown as AccountsRepository);

  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('deleteAccount', () => {
    it('deletes the account of this user', async () => {
      repository.softDeleteUnlessLast.mockResolvedValue('deleted');

      await expect(service.deleteAccount(USER_ID, ACCOUNT_ID)).resolves.toBeUndefined();
      expect(repository.softDeleteUnlessLast).toHaveBeenCalledWith(ACCOUNT_ID, USER_ID);
    });

    it('throws NotFoundError when the account is not found for this user', async () => {
      repository.softDeleteUnlessLast.mockResolvedValue('not_found');

      await expect(service.deleteAccount(USER_ID, ACCOUNT_ID)).rejects.toThrow(
        new NotFoundError('Account not found'),
      );
    });

    it('throws ConflictError when it is the only active account', async () => {
      repository.softDeleteUnlessLast.mockResolvedValue('last_account');

      await expect(service.deleteAccount(USER_ID, ACCOUNT_ID)).rejects.toThrow(
        new ConflictError('Cannot delete your only account'),
      );
    });
  });

  describe('getAllUserAccounts', () => {
    it("returns the repository's accounts for the user", async () => {
      const accounts = [{ id: ACCOUNT_ID, category: 'Personal' }];
      repository.getAllAccountByUserId.mockResolvedValue(accounts);

      await expect(service.getAllUserAccounts(USER_ID)).resolves.toBe(accounts);
      expect(repository.getAllAccountByUserId).toHaveBeenCalledWith(USER_ID);
    });
  });

  describe('createNewAccount', () => {
    it('creates the account for the user with the given category', async () => {
      const account = { id: ACCOUNT_ID, category: 'Savings' };
      repository.createNewAccountByUserId.mockResolvedValue(account);

      await expect(service.createNewAccount(USER_ID, 'Savings')).resolves.toBe(account);
      expect(repository.createNewAccountByUserId).toHaveBeenCalledWith(USER_ID, 'Savings');
    });
  });
});
