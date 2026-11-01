import { delay, http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { server } from '@/test/server';

import { apiFetch } from './api-client';
import { ApiError } from './api-error';
import { getAccessToken, setAccessToken } from './auth-token';

const url = (path: string) => `http://api.test/api/v1${path}`;

const errorResponse = (status: number, code = 'ERROR', message = 'Failed') =>
  HttpResponse.json({ statusCode: status, code, message }, { status });

// Counts hits on /auth/refresh and answers with a new access token.
function mockRefresh() {
  const calls = { count: 0 };
  server.use(
    http.post(url('/auth/refresh'), async () => {
      calls.count++;
      await delay(10); // keeps the refresh in flight long enough for concurrent 401s to share it
      return HttpResponse.json({ accessToken: 'fresh' });
    }),
  );
  return calls;
}

// A protected endpoint that only accepts the refreshed token.
function mockProtected(path = '/accounts') {
  const calls = { count: 0 };
  server.use(
    http.get(url(path), ({ request }) => {
      calls.count++;
      return request.headers.get('authorization') === 'Bearer fresh'
        ? HttpResponse.json({ ok: true })
        : errorResponse(401, 'UNAUTHORIZED');
    }),
  );
  return calls;
}

describe('apiFetch request', () => {
  it('sends the bearer token when one is set', async () => {
    setAccessToken('token-1');
    server.use(
      http.get(url('/me'), ({ request }) =>
        HttpResponse.json({ auth: request.headers.get('authorization') }),
      ),
    );

    await expect(apiFetch('/me')).resolves.toEqual({ auth: 'Bearer token-1' });
  });

  it('omits the Authorization header without a token', async () => {
    server.use(
      http.get(url('/me'), ({ request }) =>
        HttpResponse.json({ hasAuth: request.headers.has('authorization') }),
      ),
    );

    await expect(apiFetch('/me')).resolves.toEqual({ hasAuth: false });
  });

  it('sends a JSON body with a Content-Type header, and no Content-Type without a body', async () => {
    server.use(
      http.post(url('/echo'), async ({ request }) =>
        HttpResponse.json({
          contentType: request.headers.get('content-type'),
          body: await request.json(),
        }),
      ),
      http.get(url('/plain'), ({ request }) =>
        HttpResponse.json({ contentType: request.headers.get('content-type') }),
      ),
    );

    await expect(apiFetch('/echo', { method: 'POST', body: { a: 1 } })).resolves.toEqual({
      contentType: 'application/json',
      body: { a: 1 },
    });
    await expect(apiFetch('/plain')).resolves.toEqual({ contentType: null });
  });

  it('includes credentials so the refresh cookie is sent', async () => {
    server.use(
      http.get(url('/me'), ({ request }) =>
        HttpResponse.json({ credentials: request.credentials }),
      ),
    );

    await expect(apiFetch('/me')).resolves.toEqual({ credentials: 'include' });
  });
});

describe('apiFetch response', () => {
  it('returns null for an empty body', async () => {
    server.use(http.post(url('/auth/logout'), () => new HttpResponse(null, { status: 204 })));

    await expect(apiFetch('/auth/logout', { method: 'POST' })).resolves.toBeNull();
  });

  it('throws an ApiError built from the error body', async () => {
    server.use(
      http.get(url('/accounts'), () =>
        HttpResponse.json(
          { statusCode: 422, code: 'VALIDATION_ERROR', message: 'Nope', details: [{ a: 1 }] },
          { status: 422 },
        ),
      ),
    );

    await expect(apiFetch('/accounts')).rejects.toMatchObject({
      status: 422,
      code: 'VALIDATION_ERROR',
      message: 'Nope',
      details: [{ a: 1 }],
    });
  });

  it.each([
    [
      'an HTML body (proxy error page)',
      () => new HttpResponse('<h1>Bad Gateway</h1>', { status: 502 }),
    ],
    ['an empty body', () => new HttpResponse(null, { status: 502 })],
  ])('throws an ApiError carrying the HTTP status for %s', async (_label, response) => {
    server.use(http.get(url('/accounts'), response));

    const error = await apiFetch('/accounts').catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 502 });
  });
});

describe('apiFetch 401 handling', () => {
  it('refreshes once, then retries the request with the new token', async () => {
    const refresh = mockRefresh();
    const endpoint = mockProtected();
    setAccessToken('expired');

    await expect(apiFetch('/accounts')).resolves.toEqual({ ok: true });

    expect(refresh.count).toBe(1);
    expect(endpoint.count).toBe(2);
    expect(getAccessToken()).toBe('fresh');
  });

  it('shares one refresh between concurrent 401s', async () => {
    const refresh = mockRefresh();
    mockProtected('/accounts');
    mockProtected('/transactions');
    setAccessToken('expired');

    await Promise.all([apiFetch('/accounts'), apiFetch('/transactions')]);

    expect(refresh.count).toBe(1);
  });

  it('can refresh again on a later 401', async () => {
    const refresh = mockRefresh();
    mockProtected();

    setAccessToken('expired');
    await apiFetch('/accounts');
    setAccessToken('expired-again');
    await apiFetch('/accounts');

    expect(refresh.count).toBe(2);
  });

  it('clears the token and throws the refresh error when the refresh fails', async () => {
    server.use(http.post(url('/auth/refresh'), () => errorResponse(401, 'INVALID_REFRESH_TOKEN')));
    mockProtected();
    setAccessToken('expired');

    await expect(apiFetch('/accounts')).rejects.toMatchObject({
      status: 401,
      code: 'INVALID_REFRESH_TOKEN',
    });
    expect(getAccessToken()).toBeNull();
  });

  it('does not retry again when the retried request is still 401', async () => {
    const refresh = mockRefresh();
    const endpoint = { count: 0 };
    server.use(
      http.get(url('/accounts'), () => {
        endpoint.count++;
        return errorResponse(401, 'UNAUTHORIZED');
      }),
    );

    await expect(apiFetch('/accounts')).rejects.toMatchObject({ status: 401 });

    expect(refresh.count).toBe(1);
    expect(endpoint.count).toBe(2);
  });

  it.each(['/auth/login', '/auth/refresh'])('does not retry a 401 from %s', async (path) => {
    const endpoint = { count: 0 };
    server.use(
      http.post(url(path), () => {
        endpoint.count++;
        return errorResponse(401, 'UNAUTHORIZED');
      }),
    );

    await expect(apiFetch(path, { method: 'POST' })).rejects.toMatchObject({ status: 401 });

    expect(endpoint.count).toBe(1);
  });

  it.each([403, 404, 500])('does not retry a %i', async (status) => {
    const refresh = mockRefresh();
    const endpoint = { count: 0 };
    server.use(
      http.get(url('/accounts'), () => {
        endpoint.count++;
        return errorResponse(status);
      }),
    );

    await expect(apiFetch('/accounts')).rejects.toMatchObject({ status });

    expect(refresh.count).toBe(0);
    expect(endpoint.count).toBe(1);
  });
});
