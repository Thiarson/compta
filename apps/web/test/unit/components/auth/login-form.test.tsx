import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import {
  apiError,
  apiUrl,
  authPayload,
  createGate,
  mockAccounts,
  mockTransactions,
  validationError,
  verifiedUser,
} from '@test/helpers/handlers';
import { renderApp } from '@test/helpers/render';
import { server } from '@test/helpers/server';

async function submitLogin(email = 'jane@example.com', password = 'password123') {
  const user = userEvent.setup();
  await user.type(await screen.findByLabelText('Email'), email);
  await user.type(screen.getByLabelText('Password'), password);
  await user.click(screen.getByRole('button', { name: 'Login' }));
}

describe('LoginForm', () => {
  it('renders the email and password fields', async () => {
    await renderApp('/login');

    expect(await screen.findByLabelText('Email')).toHaveAttribute('type', 'email');
    expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'password');
    expect(screen.getByLabelText('Password')).toHaveAttribute('autocomplete', 'current-password');
  });

  it('logs in, then goes to the redirect target', async () => {
    let body: unknown;
    server.use(
      http.post(apiUrl('/auth/login'), async ({ request }) => {
        body = await request.json();
        return HttpResponse.json(authPayload(verifiedUser));
      }),
    );
    mockAccounts([{ id: 'a1', category: 'Cash' }]);
    mockTransactions();
    const { router } = await renderApp('/login?redirect=/accounts/a1');

    await submitLogin();

    await waitFor(() => expect(router.state.location.pathname).toBe('/accounts/a1'));
    expect(body).toEqual({ email: 'jane@example.com', password: 'password123' });
    expect(await screen.findByText('Welcome back!')).toBeInTheDocument();
  });

  it('disables the button while logging in, so a double click sends one request', async () => {
    const gate = createGate();
    let requests = 0;
    server.use(
      http.post(apiUrl('/auth/login'), async () => {
        requests++;
        await gate.opened;
        return HttpResponse.json(authPayload(verifiedUser));
      }),
    );
    mockAccounts([]);
    mockTransactions();
    await renderApp('/login');

    await submitLogin();
    const button = await screen.findByRole('button', { name: 'Logging in...' });
    expect(button).toBeDisabled();
    await userEvent.setup().dblClick(button);
    gate.open();

    await waitFor(() => expect(screen.queryByRole('button', { name: 'Login' })).toBeNull());
    expect(requests).toBe(1);
  });

  it('shows the API message in a toast for bad credentials', async () => {
    server.use(
      http.post(apiUrl('/auth/login'), () =>
        apiError(401, 'INVALID_CREDENTIALS', 'Invalid email or password'),
      ),
    );
    const { router } = await renderApp('/login');

    await submitLogin();

    expect(await screen.findByText('Invalid email or password')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/login');
  });

  it('shows validation errors inline, without a toast', async () => {
    server.use(
      http.post(apiUrl('/auth/login'), () =>
        validationError({ password: 'Password must be at least 8 characters' }),
      ),
    );
    await renderApp('/login');

    await submitLogin();

    expect(await screen.findByText('Password must be at least 8 characters')).toBeInTheDocument();
    expect(screen.queryByText('Validation failed')).toBeNull();
  });

  it('shows a generic toast when the network fails', async () => {
    server.use(http.post(apiUrl('/auth/login'), () => HttpResponse.error()));
    await renderApp('/login');

    await submitLogin();

    expect(await screen.findByText('Something went wrong')).toBeInTheDocument();
  });

  it('links to forgot-password, and to sign-up while keeping the redirect', async () => {
    await renderApp('/login?redirect=/accounts/a1');

    expect(await screen.findByRole('link', { name: 'Forgot your password?' })).toHaveAttribute(
      'href',
      '/forgot-password',
    );
    expect(screen.getByRole('link', { name: 'Sign up' })).toHaveAttribute(
      'href',
      expect.stringContaining('redirect='),
    );
  });
});
