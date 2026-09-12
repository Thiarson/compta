import { apiFetch } from '@/lib/api-client';

import type {
  CreateAccountResponse,
  AllAccountsResponse,
  CreateAccountBody,
} from '@compta/contracts';

export const accountApi = {
  allAccounts: () => apiFetch<AllAccountsResponse>('/account'),

  createNewAccount: (body: CreateAccountBody) =>
    apiFetch<CreateAccountResponse>('/account', { method: 'POST', body }),

  deleteAccount: (id: string) => apiFetch<void>(`/account/${id}`, { method: 'DELETE' }),
};
