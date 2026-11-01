import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { apiError, apiUrl, createGate, mockSession, unverifiedUser } from '@/test/handlers';
import { renderApp } from '@/test/render';
import { server } from '@/test/server';

afterEach(() => vi.useRealTimers());

function mockResend(respond: () => Response = () => new HttpResponse(null, { status: 202 })) {
  const calls = { count: 0 };
  server.use(
    http.post(apiUrl('/auth/resend-verification'), () => {
      calls.count++;
      return respond();
    }),
  );
  return calls;
}

const resendButton = (name: string | RegExp = /^Resend email/) =>
  screen.findByRole('button', { name });

describe('ResendVerification', () => {
  it('sends the email, confirms with a toast and starts a 30s cooldown', async () => {
    mockSession(unverifiedUser);
    const resend = mockResend();
    await renderApp('/verify-email');

    await userEvent.setup().click(await resendButton());

    expect(await screen.findByText('Verification email sent.')).toBeInTheDocument();
    expect(await resendButton('Resend email (30s)')).toBeDisabled();
    expect(resend.count).toBe(1);
  });

  it('counts down, then lets the user resend again', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mockSession(unverifiedUser);
    mockResend();
    await renderApp('/verify-email');
    await userEvent.setup({ advanceTimers: vi.advanceTimersByTime }).click(await resendButton());
    expect(await resendButton('Resend email (30s)')).toBeDisabled();

    // one second at a time: each tick re-arms the next timeout after React re-renders
    for (let second = 0; second < 30; second++) {
      await act(async () => vi.advanceTimersByTime(1000));
    }

    expect(await resendButton('Resend email')).toBeEnabled();
  });

  it('disables the button while sending', async () => {
    mockSession(unverifiedUser);
    const gate = createGate();
    server.use(
      http.post(apiUrl('/auth/resend-verification'), async () => {
        await gate.opened;
        return new HttpResponse(null, { status: 202 });
      }),
    );
    await renderApp('/verify-email');

    await userEvent.setup().click(await resendButton());

    expect(await resendButton('Sending...')).toBeDisabled();
    gate.open();
    expect(await resendButton('Resend email (30s)')).toBeDisabled();
  });

  it('shows the API message and no cooldown when sending fails', async () => {
    mockSession(unverifiedUser);
    mockResend(() => apiError(429, 'RATE_LIMITED', 'Too many requests, try again later'));
    await renderApp('/verify-email');

    await userEvent.setup().click(await resendButton());

    expect(await screen.findByText('Too many requests, try again later')).toBeInTheDocument();
    expect(await resendButton('Resend email')).toBeEnabled();
  });

  it('signs out and goes to /login', async () => {
    mockSession(unverifiedUser);
    server.use(http.post(apiUrl('/auth/logout'), () => new HttpResponse(null, { status: 204 })));
    const { router } = await renderApp('/verify-email');

    await userEvent.setup().click(await screen.findByRole('button', { name: 'Sign out' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
  });
});
