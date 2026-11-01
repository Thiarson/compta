import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { server } from '@/test/server';

import { apiFetch } from './api-client';
import { ApiError } from './api-error';
import { setAccessToken } from './auth-token';

const url = (path: string) => `http://api.test/api/v1${path}`;

describe('apiFetch', () => {
  it('sends the bearer token and returns the parsed body', async () => {
    setAccessToken('token-1');
    server.use(
      http.get(url('/accounts'), ({ request }) =>
        HttpResponse.json({ auth: request.headers.get('authorization') }),
      ),
    );

    await expect(apiFetch('/accounts')).resolves.toEqual({ auth: 'Bearer token-1' });
  });

  it('throws an ApiError built from the error body', async () => {
    server.use(
      http.get(url('/accounts'), () =>
        HttpResponse.json({ statusCode: 404, code: 'NOT_FOUND', message: 'Nope' }, { status: 404 }),
      ),
    );

    await expect(apiFetch('/accounts')).rejects.toMatchObject({
      name: ApiError.name,
      status: 404,
      code: 'NOT_FOUND',
      message: 'Nope',
    });
  });
});
