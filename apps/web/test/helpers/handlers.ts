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

// 400 VALIDATION_ERROR in the shape apps/api sends, from a { field: message } map.
export function validationError(fields: Record<string, string>) {
  const details = Object.entries(fields).map(([field, message]) => ({
    instancePath: `/${field}`,
    params: {},
    message,
  }));

  return HttpResponse.json(
    { statusCode: 400, code: 'VALIDATION_ERROR', message: 'Validation failed', details },
    { status: 400 },
  );
}

export const authPayload = (user: MeResponse) => ({ accessToken: 'access-1', user });

// Lets a handler hold its response until the test calls `open()`, to observe "request in flight" UI.
export function createGate() {
  let open!: () => void;
  const opened = new Promise<void>((resolve) => (open = resolve));
  return { opened, open };
}

// Everything an authenticated dashboard visit needs, in one call.
export function mockDashboardApi({
  accounts = [],
  transactions = [],
}: { accounts?: AllAccountsResponse; transactions?: AllTransactionResponse } = {}) {
  mockSession(verifiedUser);
  mockAccounts(accounts);
  mockTransactions(transactions);
}
