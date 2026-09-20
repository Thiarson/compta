import { apiFetch } from '@/lib/api-client';

import type {
  AddTransactionBody,
  AddTransactionResponse,
  AllTransactionResponse,
} from '@compta/contracts';

export const transactionApi = {
  allTransactions: () => apiFetch<AllTransactionResponse>('/transactions'),

  createNewTransaction: (body: AddTransactionBody) =>
    apiFetch<AddTransactionResponse>('/transactions', { method: 'POST', body }),

  deleteTransaction: (id: string) => apiFetch<void>(`/transactions/${id}`, { method: 'DELETE' }),
};
