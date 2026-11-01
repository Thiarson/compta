import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';

import { server } from '@/test/server';
import { renderApp } from '@/test/render';

describe('/login', () => {
  it('shows the login form to a logged-out visitor', async () => {
    server.use(
      http.get('http://api.test/api/v1/auth/me', () =>
        HttpResponse.json({ statusCode: 401, code: 'UNAUTHORIZED', message: 'x' }, { status: 401 }),
      ),
    );

    await renderApp('/login');

    expect(await screen.findByLabelText(/password/i)).toBeInTheDocument();
  });
});
