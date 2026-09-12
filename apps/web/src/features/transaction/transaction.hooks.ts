import { queryOptions, useMutation, useQuery } from '@tanstack/react-query';
import { transactionApi } from './transaction.api';
import { queryClient } from '@/lib/query-client';

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
  return useMutation({
    mutationFn: (body: AddTransactionBody) => transactionApi.createNewTransaction(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: transactionKeys.transactions() });
    },
  });
}

export function useDeleteTransaction() {
  return useMutation({
    mutationFn: (id: string) => transactionApi.deleteTransaction(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: transactionKeys.transactions() });
    },
  });
}
