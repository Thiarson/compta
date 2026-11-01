import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { apiError, apiUrl } from '@/test/handlers';
import { renderApp } from '@/test/render';
import { server } from '@/test/server';

function mockVerifyPasswordReset(respond: () => Response) {
  const bodies: unknown[] = [];
  server.use(
    http.post(apiUrl('/auth/verify-password-reset'), async ({ request }) => {
      bodies.push(await request.json());
      return respond();
    }),
  );
  return bodies;
}

describe('/reset-password', () => {
  it('shows the new password form for a valid token', async () => {
    const bodies = mockVerifyPasswordReset(() => new HttpResponse(null, { status: 204 }));

    await renderApp('/reset-password?token=abc');

    expect(await screen.findByText('Set a new password')).toBeInTheDocument();
    expect(bodies).toEqual([{ passwordResetToken: 'abc' }]);
  });

  it('rejects a missing token without calling the API', async () => {
    // no handler registered: any request would fail the test (onUnhandledRequest: 'error')
    await renderApp('/reset-password');

    expect(await screen.findByText('Link expired')).toBeInTheDocument();
    expect(screen.getByText('This password reset link is invalid.')).toBeInTheDocument();
  });

  it('shows the API message for a rejected token', async () => {
    mockVerifyPasswordReset(() =>
      apiError(400, 'INVALID_TOKEN', 'This link has already been used.'),
    );

    await renderApp('/reset-password?token=abc');

    expect(await screen.findByText('Link expired')).toBeInTheDocument();
    expect(screen.getByText('This link has already been used.')).toBeInTheDocument();
  });

  it('falls back to a generic message on a network failure', async () => {
    mockVerifyPasswordReset(() => HttpResponse.error());

    await renderApp('/reset-password?token=abc');

    expect(await screen.findByText('This link is invalid or has expired.')).toBeInTheDocument();
  });

  it('links to requesting a new reset link when the token is invalid', async () => {
    await renderApp('/reset-password');

    expect(
      await screen.findByRole('link', { name: 'Request a new password reset link' }),
    ).toHaveAttribute('href', '/forgot-password');
  });
});
