import { act, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { toast } from 'sonner';
import { describe, expect, it, vi } from 'vitest';

import { getAccessToken, setAccessToken } from '@/lib/auth-token';
import { renderHookWithProviders } from '@test/helpers/render';
import { server } from '@test/helpers/server';

import { useLogin, useLogout, useRegister, useSession } from '@/features/auth/auth.hooks';
import { authKeys } from '@/features/auth/auth.keys';

import type { UseMutationResult } from '@tanstack/react-query';
import type { AuthResponse } from '@compta/contracts';

const url = (path: string) => `http://api.test/api/v1${path}`;

const user = { id: 'u1', username: 'jane', email: 'jane@example.com', emailVerifiedAt: null };
const authPayload = { accessToken: 'access-1', user };

const unauthorized = () =>
  HttpResponse.json({ statusCode: 401, code: 'UNAUTHORIZED', message: 'No' }, { status: 401 });

// useLogin and useRegister share the same success/failure contract.
function describeAuthMutation<TVariables>(
  name: string,
  useHook: () => UseMutationResult<AuthResponse, Error, TVariables>,
  path: string,
  body: TVariables,
) {
  describe(name, () => {
    it('stores the access token and seeds the session cache', async () => {
      server.use(http.post(url(path), () => HttpResponse.json(authPayload)));
      const { result, queryClient } = renderHookWithProviders(useHook);

      await act(() => result.current.mutateAsync(body));

      expect(getAccessToken()).toBe('access-1');
      expect(queryClient.getQueryData(authKeys.session())).toEqual(user);
    });

    it('leaves the token and session untouched on failure', async () => {
      server.use(http.post(url(path), unauthorized));
      const { result, queryClient } = renderHookWithProviders(useHook);

      await act(() => result.current.mutateAsync(body).catch(() => {}));

      expect(getAccessToken()).toBeNull();
      expect(queryClient.getQueryData(authKeys.session())).toBeUndefined();
    });
  });
}

describeAuthMutation('useLogin', useLogin, '/auth/login', {
  email: 'jane@example.com',
  password: 'password123',
});

describeAuthMutation('useRegister', useRegister, '/auth/register', {
  username: 'jane',
  email: 'jane@example.com',
  password: 'password123',
});

describe('useLogout', () => {
  it('clears the token and all cached data, then goes to /login', async () => {
    server.use(http.post(url('/auth/logout'), () => new HttpResponse(null, { status: 204 })));
    const success = vi.spyOn(toast, 'success').mockReturnValue('id');
    setAccessToken('access-1');
    const { result, queryClient, router } = renderHookWithProviders(useLogout);
    queryClient.setQueryData(authKeys.session(), user);
    // Another user must never see this account's data after signing in on the same tab.
    queryClient.setQueryData(['account'], [{ id: 'a1', category: 'Cash' }]);

    await act(() => result.current.mutateAsync());

    expect(getAccessToken()).toBeNull();
    expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
    expect(success).toHaveBeenCalledWith('Signed out');
  });

  it('keeps the user signed in when the request fails', async () => {
    server.use(
      http.post(url('/auth/logout'), () =>
        HttpResponse.json({ statusCode: 500, code: 'INTERNAL', message: 'Oops' }, { status: 500 }),
      ),
    );
    setAccessToken('access-1');
    const { result, queryClient, router } = renderHookWithProviders(useLogout);
    queryClient.setQueryData(authKeys.session(), user);

    await act(() => result.current.mutateAsync().catch(() => {}));

    expect(getAccessToken()).toBe('access-1');
    expect(queryClient.getQueryData(authKeys.session())).toEqual(user);
    expect(router.state.location.pathname).toBe('/');
  });
});

describe('useSession', () => {
  it('loads the current user', async () => {
    server.use(http.get(url('/auth/me'), () => HttpResponse.json(user)));
    const { result } = renderHookWithProviders(useSession);

    await waitFor(() => expect(result.current.data).toEqual(user));
  });

  it('does not retry when there is no session', async () => {
    let meCalls = 0;
    server.use(
      http.get(url('/auth/me'), () => {
        meCalls++;
        return unauthorized();
      }),
      http.post(url('/auth/refresh'), unauthorized),
    );
    const { result } = renderHookWithProviders(useSession);

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(meCalls).toBe(1);
  });
});
