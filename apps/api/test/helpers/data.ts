import { API, call } from './api.js';

import type { TestApp } from './app.js';

type Headers = Record<string, string>;

export async function listAccounts(app: TestApp, headers: Headers) {
  const res = await call(app, { method: 'GET', url: `${API}/accounts`, headers });
  return res.json() as { id: string; category: string }[];
}

export async function createAccount(app: TestApp, headers: Headers, category = 'Savings') {
  const res = await call(app, {
    method: 'POST',
    url: `${API}/accounts`,
    headers,
    payload: { category },
  });
  if (res.statusCode !== 201) {
    throw new Error(`createAccount failed: ${res.statusCode} ${res.body}`);
  }
  return res.json() as { id: string; category: string };
}

export function buildTransactionPayload(
  accountId: string,
  overrides: Record<string, unknown> = {},
) {
  return {
    accountId,
    type: 'expense',
    amount: 1500,
    description: 'Groceries',
    date: '2026-01-15',
    ...overrides,
  };
}

export async function createTransaction(
  app: TestApp,
  headers: Headers,
  accountId: string,
  overrides: Record<string, unknown> = {},
) {
  const res = await call(app, {
    method: 'POST',
    url: `${API}/transactions`,
    headers,
    payload: buildTransactionPayload(accountId, overrides),
  });
  if (res.statusCode !== 201) {
    throw new Error(`createTransaction failed: ${res.statusCode} ${res.body}`);
  }
  return res.json() as { id: string; accountId: string; amount: number; date: string };
}
