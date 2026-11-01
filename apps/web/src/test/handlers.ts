import { http, HttpResponse } from 'msw';

import { server } from './server';

import type { AllAccountsResponse, AllTransactionResponse, MeResponse } from '@compta/contracts';

export const apiUrl = (path: string) => `http://api.test/api/v1${path}`;

export const apiError = (status: number, code: string, message: string) =>
  HttpResponse.json({ statusCode: status, code, message }, { status });

export const verifiedUser: MeResponse = {
  id: 'u1',
  username: 'jane',
  email: 'jane@example.com',
  emailVerifiedAt: '2025-01-01T00:00:00.000Z',
};

export const unverifiedUser: MeResponse = { ...verifiedUser, emailVerifiedAt: null };

// `null` = logged out: /me answers 401 and the silent refresh fails too.
export function mockSession(user: MeResponse | null) {
  server.use(
    http.get(apiUrl('/auth/me'), () =>
      user ? HttpResponse.json(user) : apiError(401, 'UNAUTHORIZED', 'Not logged in'),
    ),
    http.post(apiUrl('/auth/refresh'), () =>
      apiError(401, 'INVALID_REFRESH_TOKEN', 'No refresh token'),
    ),
  );
}

export function mockAccounts(accounts: AllAccountsResponse) {
  server.use(http.get(apiUrl('/accounts'), () => HttpResponse.json(accounts)));
}

export function mockTransactions(transactions: AllTransactionResponse = []) {
  server.use(http.get(apiUrl('/transactions'), () => HttpResponse.json(transactions)));
}
