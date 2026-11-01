import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { apiError, apiUrl, createGate, validationError } from '@/test/handlers';
import { renderApp } from '@/test/render';
import { server } from '@/test/server';

async function submitEmail(email = 'jane@example.com') {
  const user = userEvent.setup();
  await user.type(await screen.findByLabelText('Email'), email);
  await user.click(screen.getByRole('button', { name: 'Send reset link' }));
  return user;
}

describe('ForgotPasswordForm', () => {
  it('confirms that a link was sent, without revealing whether the account exists', async () => {
    let body: unknown;
    server.use(
      http.post(apiUrl('/auth/forgot-password'), async ({ request }) => {
        body = await request.json();
        return new HttpResponse(null, { status: 204 });
      }),
    );
    await renderApp('/forgot-password');

    await submitEmail();

    expect(await screen.findByText('Check your email')).toBeInTheDocument();
    expect(screen.getByText(/If an account exists for/)).toBeInTheDocument();
    expect(screen.getByText('jane@example.com')).toBeInTheDocument();
    expect(screen.getByText(/expires in 30 minutes/)).toBeInTheDocument();
    expect(body).toEqual({ email: 'jane@example.com' });
  });

  it('goes back to the form with "try another email"', async () => {
    server.use(
      http.post(apiUrl('/auth/forgot-password'), () => new HttpResponse(null, { status: 204 })),
    );
    await renderApp('/forgot-password');
    const user = await submitEmail();

    await user.click(await screen.findByRole('link', { name: 'try another email' }));

    expect(await screen.findByText('Reset your password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send reset link' })).toBeEnabled();
  });

  it('disables the button while sending', async () => {
    const gate = createGate();
    server.use(
      http.post(apiUrl('/auth/forgot-password'), async () => {
        await gate.opened;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    await renderApp('/forgot-password');

    await submitEmail();

    expect(await screen.findByRole('button', { name: 'Sending...' })).toBeDisabled();
    gate.open();
    expect(await screen.findByText('Check your email')).toBeInTheDocument();
  });

  it('shows validation errors inline, without a toast', async () => {
    server.use(
      http.post(apiUrl('/auth/forgot-password'), () =>
        validationError({ email: 'Invalid email address' }),
      ),
    );
    await renderApp('/forgot-password');

    await submitEmail('not-an-email@x');

    expect(await screen.findByText('Invalid email address')).toBeInTheDocument();
    expect(screen.queryByText('Validation failed')).toBeNull();
  });

  it('shows the API message when rate limited', async () => {
    server.use(
      http.post(apiUrl('/auth/forgot-password'), () =>
        apiError(429, 'RATE_LIMITED', 'Too many requests, try again later'),
      ),
    );
    await renderApp('/forgot-password');

    await submitEmail();

    expect(await screen.findByText('Too many requests, try again later')).toBeInTheDocument();
    expect(screen.getByText('Reset your password')).toBeInTheDocument();
  });

  it('shows a generic toast when the network fails', async () => {
    server.use(http.post(apiUrl('/auth/forgot-password'), () => HttpResponse.error()));
    await renderApp('/forgot-password');

    await submitEmail();

    expect(await screen.findByText('Something went wrong')).toBeInTheDocument();
  });

  it('links back to login', async () => {
    await renderApp('/forgot-password');

    expect(await screen.findByRole('link', { name: 'Back to login' })).toHaveAttribute(
      'href',
      '/login',
    );
  });
});
