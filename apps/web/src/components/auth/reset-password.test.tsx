import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';

import { apiError, apiUrl, createGate, validationError } from '@/test/handlers';
import { renderApp } from '@/test/render';
import { server } from '@/test/server';

beforeEach(() => {
  server.use(
    http.post(apiUrl('/auth/verify-password-reset'), () => new HttpResponse(null, { status: 204 })),
  );
});

async function fillResetForm({ confirm = 'new-password-1' }: { confirm?: string } = {}) {
  const user = userEvent.setup();
  await user.type(await screen.findByLabelText('New password'), 'new-password-1');
  await user.type(screen.getByLabelText('Confirm new password'), confirm);
  return user;
}

const submitButton = () => screen.getByRole('button', { name: 'Reset password' });

describe('ResetPasswordForm', () => {
  it('blocks submission and explains when the passwords differ', async () => {
    await renderApp('/reset-password?token=abc');

    const user = await fillResetForm({ confirm: 'different' });

    expect(screen.getByText("Passwords don't match")).toBeInTheDocument();
    expect(screen.getByLabelText('Confirm new password')).toHaveAttribute('aria-invalid', 'true');
    expect(submitButton()).toBeDisabled();

    await user.clear(screen.getByLabelText('Confirm new password'));
    await user.type(screen.getByLabelText('Confirm new password'), 'new-password-1');

    expect(screen.queryByText("Passwords don't match")).toBeNull();
    expect(submitButton()).toBeEnabled();
  });

  it('resets the password, then goes to /login', async () => {
    let body: unknown;
    server.use(
      http.post(apiUrl('/auth/reset-password'), async ({ request }) => {
        body = await request.json();
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const { router } = await renderApp('/reset-password?token=abc');

    const user = await fillResetForm();
    await user.click(submitButton());

    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
    expect(body).toEqual({ passwordResetToken: 'abc', newPassword: 'new-password-1' });
    expect(
      await screen.findByText('Password reset. Please log in with your new password.'),
    ).toBeInTheDocument();
  });

  it('disables the button while resetting', async () => {
    const gate = createGate();
    server.use(
      http.post(apiUrl('/auth/reset-password'), async () => {
        await gate.opened;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    await renderApp('/reset-password?token=abc');

    const user = await fillResetForm();
    await user.click(submitButton());

    expect(await screen.findByRole('button', { name: 'Resetting...' })).toBeDisabled();
    gate.open();
  });

  it('shows validation errors inline, without a toast', async () => {
    server.use(
      http.post(apiUrl('/auth/reset-password'), () =>
        validationError({ newPassword: 'Password must be at least 8 characters' }),
      ),
    );
    await renderApp('/reset-password?token=abc');

    const user = await fillResetForm();
    await user.click(submitButton());

    expect(await screen.findByText('Password must be at least 8 characters')).toBeInTheDocument();
    expect(screen.queryByText('Validation failed')).toBeNull();
  });

  it('shows the API message when the token was already used', async () => {
    server.use(
      http.post(apiUrl('/auth/reset-password'), () =>
        apiError(400, 'INVALID_TOKEN', 'This link has already been used.'),
      ),
    );
    const { router } = await renderApp('/reset-password?token=abc');

    const user = await fillResetForm();
    await user.click(submitButton());

    expect(await screen.findByText('This link has already been used.')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/reset-password');
  });
});
