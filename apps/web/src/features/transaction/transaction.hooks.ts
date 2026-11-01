import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { transactionApi } from './transaction.api';

import type { AddTransactionBody, AllTransactionResponse } from '@compta/contracts';

export type { TransactionType } from '@compta/contracts';

export type Transaction = AllTransactionResponse[number];

const transactionKeys = {
  transactions: () => ['transaction'] as const,
};

const transactionQueryOptions = queryOptions({
  queryKey: transactionKeys.transactions(),
  queryFn: transactionApi.allTransactions,
});

export function useTransactions() {
  return useQuery(transactionQueryOptions);
}

export function useCreateTransaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: AddTransactionBody) => transactionApi.createNewTransaction(body),
    // returned so the mutation stays pending until the list is refetched
    onSuccess: () => queryClient.invalidateQueries({ queryKey: transactionKeys.transactions() }),
  });
}

export function useDeleteTransaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => transactionApi.deleteTransaction(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: transactionKeys.transactions() }),
  });
}
