import { act, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import { renderHookWithProviders } from '@/test/render';
import { server } from '@/test/server';

import {
  createAccountDeletedHandler,
  useAccount,
  useCreateAccount,
  useDeleteAccount,
} from './account.hooks';

const accounts = [
  { id: 'a', category: 'Cash' },
  { id: 'b', category: 'Bank' },
] as Parameters<typeof createAccountDeletedHandler>[0];

describe('createAccountDeletedHandler', () => {
  it('selects another account when the active one is deleted', () => {
    const onSelect = vi.fn();

    createAccountDeletedHandler(accounts, 'a', onSelect)('a');

    expect(onSelect).toHaveBeenCalledExactlyOnceWith('b');
  });

  it('does nothing when a non-active account is deleted', () => {
    const onSelect = vi.fn();

    createAccountDeletedHandler(accounts, 'a', onSelect)('b');

    expect(onSelect).not.toHaveBeenCalled();
  });

  it('does nothing when no other account is left', () => {
    const onSelect = vi.fn();

    createAccountDeletedHandler([accounts![0]], 'a', onSelect)('a');

    expect(onSelect).not.toHaveBeenCalled();
  });

  it('does nothing when accounts are not loaded', () => {
    const onSelect = vi.fn();

    createAccountDeletedHandler(undefined, 'a', onSelect)('a');

    expect(onSelect).not.toHaveBeenCalled();
  });
});

const url = (path: string) => `http://api.test/api/v1${path}`;

// Serves a mutable account list and counts how often it is fetched.
function mockAccountList(initial: { id: string; category: string }[]) {
  const state = { list: initial, fetches: 0 };
  server.use(
    http.get(url('/accounts'), () => {
      state.fetches++;
      return HttpResponse.json(state.list);
    }),
  );
  return state;
}

const serverError = () =>
  HttpResponse.json({ statusCode: 500, code: 'INTERNAL', message: 'Oops' }, { status: 500 });

describe('useCreateAccount', () => {
  it('posts the account, then refreshes the list before resolving', async () => {
    const accounts = mockAccountList([]);
    server.use(
      http.post(url('/accounts'), async ({ request }) => {
        const body = (await request.json()) as { category: string };
        accounts.list = [{ id: 'a1', category: body.category }];
        return HttpResponse.json(accounts.list[0], { status: 201 });
      }),
    );
    const { result } = renderHookWithProviders(() => ({
      list: useAccount(),
      create: useCreateAccount(),
    }));
    await waitFor(() => expect(result.current.list.data).toEqual([]));

    await act(() => result.current.create.mutateAsync({ category: 'Cash' }));

    // mutateAsync only resolves once the invalidated list has been refetched
    expect(accounts.fetches).toBe(2);
    await waitFor(() => expect(result.current.list.data).toEqual([{ id: 'a1', category: 'Cash' }]));
  });

  it('does not refresh the list when the request fails', async () => {
    const accounts = mockAccountList([]);
    server.use(http.post(url('/accounts'), serverError));
    const { result } = renderHookWithProviders(() => ({
      list: useAccount(),
      create: useCreateAccount(),
    }));
    await waitFor(() => expect(result.current.list.isSuccess).toBe(true));

    await act(() => result.current.create.mutateAsync({ category: 'Cash' }).catch(() => {}));

    await waitFor(() => expect(result.current.create.isError).toBe(true));
    expect(accounts.fetches).toBe(1);
  });
});

describe('useDeleteAccount', () => {
  it('deletes the account, then refreshes the list', async () => {
    const accounts = mockAccountList([{ id: 'a1', category: 'Cash' }]);
    server.use(
      http.delete(url('/accounts/a1'), () => {
        accounts.list = [];
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const { result } = renderHookWithProviders(() => ({
      list: useAccount(),
      remove: useDeleteAccount(),
    }));
    await waitFor(() => expect(result.current.list.data).toHaveLength(1));

    await act(() => result.current.remove.mutateAsync('a1'));

    expect(accounts.fetches).toBe(2);
    await waitFor(() => expect(result.current.list.data).toEqual([]));
  });

  it('does not refresh the list when the request fails', async () => {
    const accounts = mockAccountList([{ id: 'a1', category: 'Cash' }]);
    server.use(http.delete(url('/accounts/a1'), serverError));
    const { result } = renderHookWithProviders(() => ({
      list: useAccount(),
      remove: useDeleteAccount(),
    }));
    await waitFor(() => expect(result.current.list.isSuccess).toBe(true));

    await act(() => result.current.remove.mutateAsync('a1').catch(() => {}));

    await waitFor(() => expect(result.current.remove.isError).toBe(true));
    expect(accounts.fetches).toBe(1);
  });
});
