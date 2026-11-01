import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { accountApi } from './account.api';

import type { AllAccountsResponse } from '@compta/contracts';

const accountKeys = {
  accounts: () => ['account'] as const,
};

export const accountQueryOptions = queryOptions({
  queryKey: accountKeys.accounts(),
  queryFn: accountApi.allAccounts,
});

export function useAccount() {
  return useQuery(accountQueryOptions);
}

export function useCreateAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: accountApi.createNewAccount,
    // returned so the mutation stays pending until the list is refetched
    onSuccess: () => queryClient.invalidateQueries({ queryKey: accountKeys.accounts() }),
  });
}

export function useDeleteAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: accountApi.deleteAccount,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: accountKeys.accounts() }),
  });
}

export function createAccountDeletedHandler(
  accounts: AllAccountsResponse | undefined,
  activeAccountId: string | undefined,
  onSelect: (accountId: string) => void,
) {
  return (deletedId: string) => {
    if (deletedId !== activeAccountId) return;

    const next = accounts?.find((account) => account.id !== deletedId);
    if (next) onSelect(next.id);
  };
}
