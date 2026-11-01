import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import {
  apiError,
  apiUrl,
  mockAccounts,
  mockSession,
  mockTransactions,
  unverifiedUser,
  verifiedUser,
} from '@/test/handlers';
import { renderApp } from '@/test/render';
import { server } from '@/test/server';

// Counts calls to POST /auth/verify-email and answers with `respond`.
function mockVerifyEmail(respond: () => Response) {
  const calls = { count: 0, bodies: [] as unknown[] };
  server.use(
    http.post(apiUrl('/auth/verify-email'), async ({ request }) => {
      calls.count++;
      calls.bodies.push(await request.json());
      return respond();
    }),
  );
  return calls;
}

const verified = () => new HttpResponse(null, { status: 204 });
const rejected = () => apiError(400, 'INVALID_TOKEN', 'This verification link has expired.');

describe('/verify-email with a token', () => {
  it('verifies exactly once, even when logged out (link opened on another device)', async () => {
    mockSession(null);
    const verify = mockVerifyEmail(verified);

    await renderApp('/verify-email?token=abc');

    expect(await screen.findByText('Email verified')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Continue to login' })).toBeInTheDocument();
    expect(verify.count).toBe(1);
    expect(verify.bodies).toEqual([{ verificationToken: 'abc' }]);
  });

  it('offers to continue to the dashboard when the user is logged in', async () => {
    mockSession(verifiedUser);
    mockVerifyEmail(verified);

    await renderApp('/verify-email?token=abc');

    expect(
      await screen.findByRole('button', { name: 'Continue to dashboard' }),
    ).toBeInTheDocument();
  });

  it('shows the API message when the link is rejected and the user is logged out', async () => {
    mockSession(null);
    mockVerifyEmail(rejected);

    await renderApp('/verify-email?token=abc');

    expect(await screen.findByText('Verification failed')).toBeInTheDocument();
    expect(screen.getByText('This verification link has expired.')).toBeInTheDocument();
  });

  it('lets a logged-in user resend when the link is rejected', async () => {
    mockSession(unverifiedUser);
    mockVerifyEmail(rejected);

    await renderApp('/verify-email?token=abc');

    expect(await screen.findByText('This verification link has expired.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Resend email' })).toBeInTheDocument();
  });

  it('falls back to a generic message on a network failure', async () => {
    mockSession(null);
    mockVerifyEmail(() => HttpResponse.error());

    await renderApp('/verify-email?token=abc');

    expect(await screen.findByText('This link is invalid or has expired.')).toBeInTheDocument();
  });
});

describe('/verify-email without a token', () => {
  it('sends a logged-out visitor to /login', async () => {
    mockSession(null);

    const { router } = await renderApp('/verify-email');

    expect(router.state.location.pathname).toBe('/login');
  });

  it('sends an already verified user on to the redirect target', async () => {
    mockSession(verifiedUser);
    mockAccounts([{ id: 'a1', category: 'Cash' }]);
    mockTransactions();

    const { router } = await renderApp('/verify-email?redirect=/accounts/a1');

    expect(router.state.location.pathname).toBe('/accounts/a1');
  });

  it('asks an unverified user to check their inbox', async () => {
    mockSession(unverifiedUser);

    await renderApp('/verify-email');

    expect(await screen.findByText('Verify your email')).toBeInTheDocument();
    expect(screen.getByText(unverifiedUser.email)).toBeInTheDocument();
  });
});
