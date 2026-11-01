import { act, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { renderHookWithProviders } from '@test/helpers/render';
import { server } from '@test/helpers/server';

import {
  useCreateTransaction,
  useDeleteTransaction,
  useTransactions,
} from '@/features/transaction/transaction.hooks';

const url = (path: string) => `http://api.test/api/v1${path}`;

const transaction = {
  id: 't1',
  accountId: 'a1',
  type: 'income',
  amount: 5000,
  description: 'Salary',
  date: '2025-06-01',
  createdAt: '2025-06-01T08:00:00.000Z',
} as const;

const newTransaction = {
  accountId: 'a1',
  type: 'income',
  amount: 5000,
  description: 'Salary',
  date: '2025-06-01',
} as const;

// Serves a mutable transaction list and counts how often it is fetched.
function mockTransactionList(initial: (typeof transaction)[]) {
  const state = { list: initial, fetches: 0 };
  server.use(
    http.get(url('/transactions'), () => {
      state.fetches++;
      return HttpResponse.json(state.list);
    }),
  );
  return state;
}

const serverError = () =>
  HttpResponse.json({ statusCode: 500, code: 'INTERNAL', message: 'Oops' }, { status: 500 });

describe('useCreateTransaction', () => {
  it('posts the transaction, then refreshes the list before resolving', async () => {
    const transactions = mockTransactionList([]);
    server.use(
      http.post(url('/transactions'), async ({ request }) => {
        expect(await request.json()).toEqual(newTransaction);
        transactions.list = [transaction];
        return HttpResponse.json(transaction, { status: 201 });
      }),
    );
    const { result } = renderHookWithProviders(() => ({
      list: useTransactions(),
      create: useCreateTransaction(),
    }));
    await waitFor(() => expect(result.current.list.data).toEqual([]));

    await act(() => result.current.create.mutateAsync(newTransaction));

    // mutateAsync only resolves once the invalidated list has been refetched
    expect(transactions.fetches).toBe(2);
    await waitFor(() => expect(result.current.list.data).toEqual([transaction]));
  });

  it('does not refresh the list when the request fails', async () => {
    const transactions = mockTransactionList([]);
    server.use(http.post(url('/transactions'), serverError));
    const { result } = renderHookWithProviders(() => ({
      list: useTransactions(),
      create: useCreateTransaction(),
    }));
    await waitFor(() => expect(result.current.list.isSuccess).toBe(true));

    await act(() => result.current.create.mutateAsync(newTransaction).catch(() => {}));

    await waitFor(() => expect(result.current.create.isError).toBe(true));
    expect(transactions.fetches).toBe(1);
  });
});

describe('useDeleteTransaction', () => {
  it('deletes the transaction, then refreshes the list', async () => {
    const transactions = mockTransactionList([transaction]);
    server.use(
      http.delete(url('/transactions/t1'), () => {
        transactions.list = [];
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const { result } = renderHookWithProviders(() => ({
      list: useTransactions(),
      remove: useDeleteTransaction(),
    }));
    await waitFor(() => expect(result.current.list.data).toHaveLength(1));

    await act(() => result.current.remove.mutateAsync('t1'));

    expect(transactions.fetches).toBe(2);
    await waitFor(() => expect(result.current.list.data).toEqual([]));
  });

  it('does not refresh the list when the request fails', async () => {
    const transactions = mockTransactionList([transaction]);
    server.use(http.delete(url('/transactions/t1'), serverError));
    const { result } = renderHookWithProviders(() => ({
      list: useTransactions(),
      remove: useDeleteTransaction(),
    }));
    await waitFor(() => expect(result.current.list.isSuccess).toBe(true));

    await act(() => result.current.remove.mutateAsync('t1').catch(() => {}));

    await waitFor(() => expect(result.current.remove.isError).toBe(true));
    expect(transactions.fetches).toBe(1);
  });
});
