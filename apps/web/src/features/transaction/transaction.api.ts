import { apiFetch } from '@/lib/api-client';

import type {
  AddTransactionBody,
  AddTransactionResponse,
  AllTransactionResponse,
} from '@compta/contracts';

export const transactionApi = {
  allTransactions: () => apiFetch<AllTransactionResponse>('/transaction'),

  createNewTransaction: (body: AddTransactionBody) =>
    apiFetch<AddTransactionResponse>('/transaction', { method: 'POST', body }),

  deleteTransaction: (id: string) => apiFetch<void>(`/transaction/${id}`, { method: 'DELETE' }),
};
