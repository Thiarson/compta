import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import {
  apiError,
  apiUrl,
  authPayload,
  unverifiedUser,
  validationError,
} from '@test/helpers/handlers';
import { renderApp } from '@test/helpers/render';
import { server } from '@test/helpers/server';

async function fillSignup({ confirm = 'password123' }: { confirm?: string } = {}) {
  const user = userEvent.setup();
  await user.type(await screen.findByLabelText('Username'), 'jane');
  await user.type(screen.getByLabelText('Email'), 'jane@example.com');
  await user.type(screen.getByLabelText('Password'), 'password123');
  await user.type(screen.getByLabelText('Confirm Password'), confirm);
  return user;
}

const submitButton = () => screen.getByRole('button', { name: 'Create Account' });

describe('SignupForm', () => {
  it('blocks submission while the passwords differ and flags the confirm field', async () => {
    await renderApp('/signup');

    const user = await fillSignup({ confirm: 'different' });

    expect(submitButton()).toBeDisabled();
    expect(screen.getByLabelText('Confirm Password')).toHaveAttribute('aria-invalid', 'true');

    await user.clear(screen.getByLabelText('Confirm Password'));
    await user.type(screen.getByLabelText('Confirm Password'), 'password123');

    expect(submitButton()).toBeEnabled();
    expect(screen.getByLabelText('Confirm Password')).toHaveAttribute('aria-invalid', 'false');
  });

  it('registers, then goes to /verify-email keeping the redirect', async () => {
    let body: unknown;
    server.use(
      http.post(apiUrl('/auth/register'), async ({ request }) => {
        body = await request.json();
        return HttpResponse.json(authPayload(unverifiedUser), { status: 201 });
      }),
    );
    const { router } = await renderApp('/signup?redirect=/accounts/a1');

    const user = await fillSignup();
    await user.click(submitButton());

    await waitFor(() => expect(router.state.location.pathname).toBe('/verify-email'));
    expect(router.state.location.search).toEqual({ redirect: '/accounts/a1' });
    // the confirmation field is client-side only
    expect(body).toEqual({ username: 'jane', email: 'jane@example.com', password: 'password123' });
    expect(await screen.findByText('Account created — check your email to verify.')).toBeVisible();
  });

  it('shows server validation errors under the matching fields', async () => {
    server.use(
      http.post(apiUrl('/auth/register'), () =>
        validationError({
          username: 'Username must be at least 2 characters',
          email: 'Invalid email address',
          password: 'Password must be at least 8 characters',
        }),
      ),
    );
    await renderApp('/signup');

    const user = await fillSignup();
    await user.click(submitButton());

    expect(await screen.findByText('Username must be at least 2 characters')).toBeInTheDocument();
    expect(screen.getByText('Invalid email address')).toBeInTheDocument();
    expect(screen.getByText('Password must be at least 8 characters')).toBeInTheDocument();
    expect(screen.queryByText('Validation failed')).toBeNull();
  });

  it('shows the API message in a toast when the email is already taken', async () => {
    server.use(
      http.post(apiUrl('/auth/register'), () =>
        apiError(409, 'CONFLICT', 'Email or username already in use'),
      ),
    );
    const { router } = await renderApp('/signup');

    const user = await fillSignup();
    await user.click(submitButton());

    expect(await screen.findByText('Email or username already in use')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/signup');
  });

  it('links back to login while keeping the redirect', async () => {
    await renderApp('/signup?redirect=/accounts/a1');

    expect(await screen.findByRole('link', { name: 'Sign in' })).toHaveAttribute(
      'href',
      expect.stringContaining('redirect='),
    );
  });
});
