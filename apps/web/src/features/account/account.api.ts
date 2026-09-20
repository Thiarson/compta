import { apiFetch } from '@/lib/api-client';

import type {
  CreateAccountResponse,
  AllAccountsResponse,
  CreateAccountBody,
} from '@compta/contracts';

export const accountApi = {
  allAccounts: () => apiFetch<AllAccountsResponse>('/accounts'),

  createNewAccount: (body: CreateAccountBody) =>
    apiFetch<CreateAccountResponse>('/accounts', { method: 'POST', body }),

  deleteAccount: (id: string) => apiFetch<void>(`/accounts/${id}`, { method: 'DELETE' }),
};
