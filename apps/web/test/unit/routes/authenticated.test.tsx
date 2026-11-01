import { screen } from '@testing-library/react';
import { http } from 'msw';
import { describe, expect, it } from 'vitest';

import {
  apiError,
  apiUrl,
  mockAccounts,
  mockSession,
  mockTransactions,
  unverifiedUser,
  verifiedUser,
} from '@test/helpers/handlers';
import { renderApp } from '@test/helpers/render';
import { server } from '@test/helpers/server';

const accounts = [
  { id: 'a1', category: 'Cash' },
  { id: 'a2', category: 'Bank' },
];

describe('_authenticated guard', () => {
  it('sends a logged-out visitor to /login, remembering where they were going', async () => {
    mockSession(null);

    const { router } = await renderApp('/accounts/a1');

    expect(router.state.location.pathname).toBe('/login');
    expect(router.state.location.search).toEqual({ redirect: '/accounts/a1' });
  });

  it('sends a user with an unverified email to /verify-email', async () => {
    mockSession(unverifiedUser);

    const { router } = await renderApp('/accounts/a1');

    expect(router.state.location.pathname).toBe('/verify-email');
    expect(router.state.location.search).toEqual({ redirect: '/accounts/a1' });
  });
});

describe('/ (index)', () => {
  it('redirects to the first account', async () => {
    mockSession(verifiedUser);
    mockAccounts(accounts);
    mockTransactions();

    const { router } = await renderApp('/');

    expect(router.state.location.pathname).toBe('/accounts/a1');
    expect(await screen.findByText('Balance')).toBeInTheDocument();
  });

  it('shows the empty state when there are no accounts', async () => {
    mockSession(verifiedUser);
    mockAccounts([]);
    mockTransactions();

    const { router } = await renderApp('/');

    expect(router.state.location.pathname).toBe('/');
    expect(await screen.findByText('No accounts yet')).toBeInTheDocument();
  });
});

describe('/accounts/$accountId', () => {
  it('renders the dashboard for one of the user’s accounts', async () => {
    mockSession(verifiedUser);
    mockAccounts(accounts);
    mockTransactions();

    const { router } = await renderApp('/accounts/a2');

    expect(router.state.location.pathname).toBe('/accounts/a2');
    expect(await screen.findByText('Balance')).toBeInTheDocument();
  });

  it('falls back to the first account for an id the user does not own', async () => {
    mockSession(verifiedUser);
    mockAccounts(accounts);
    mockTransactions();

    const { router } = await renderApp('/accounts/someone-elses-account');

    expect(router.state.location.pathname).toBe('/accounts/a1');
  });
});

describe('/login when already signed in', () => {
  it.each([
    ['/login?redirect=/accounts/a2', '/accounts/a2'],
    ['/login', '/accounts/a1'],
  ])('%s ends up on %s', async (from, expected) => {
    mockSession(verifiedUser);
    mockAccounts(accounts);
    mockTransactions();
    // the session cache is filled by visiting a protected page first
    const { router } = await renderApp('/accounts/a1');

    await router.navigate({ href: from });

    expect(router.state.location.pathname).toBe(expected);
  });
});

describe('error handling', () => {
  it('shows the not-found page for an unknown URL', async () => {
    mockSession(null);

    await renderApp('/does-not-exist');

    expect(await screen.findByText('Page not found')).toBeInTheDocument();
  });

  it('shows the error page when a route loader fails', async () => {
    mockSession(verifiedUser);
    server.use(http.get(apiUrl('/accounts'), () => apiError(500, 'INTERNAL', 'Database down')));

    await renderApp('/');

    expect(await screen.findByText('Something went wrong')).toBeInTheDocument();
  });
});
