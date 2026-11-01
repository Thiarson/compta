import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { AuthPending } from '@/components/auth/auth-pending';
import {
  apiUrl,
  authPayload,
  mockDashboardApi,
  mockSession,
  unverifiedUser,
  validationError,
  verifiedUser,
} from '@test/helpers/handlers';
import { expectNoA11yViolations } from '@test/helpers/a11y';
import { renderApp } from '@test/helpers/render';
import { server } from '@test/helpers/server';

const accounts = [
  { id: 'a1', category: 'Cash' },
  { id: 'a2', category: 'Bank' },
];

const transactions = [
  {
    id: 't1',
    accountId: 'a1',
    type: 'income' as const,
    amount: 5000,
    description: 'Salary',
    date: new Date().toLocaleDateString('en-CA'),
    createdAt: '2025-06-01T00:00:00.000Z',
  },
];

const pages: [string, string, () => void, string][] = [
  ['login', '/login', () => {}, 'Login to your account'],
  ['signup', '/signup', () => {}, 'Create an account'],
  ['forgot password', '/forgot-password', () => {}, 'Reset your password'],
  [
    'reset password',
    '/reset-password?token=abc',
    () =>
      server.use(
        http.post(
          apiUrl('/auth/verify-password-reset'),
          () => new HttpResponse(null, { status: 204 }),
        ),
      ),
    'Set a new password',
  ],
  ['verify email', '/verify-email', () => mockSession(unverifiedUser), 'Verify your email'],
  ['not found', '/nope', () => mockSession(null), 'Page not found'],
  ['dashboard', '/accounts/a1', () => mockDashboardApi({ accounts, transactions }), 'Salary'],
  ['dashboard without accounts', '/', () => mockDashboardApi(), 'No accounts yet'],
];

describe('pages have no detectable accessibility violations', () => {
  it.each(pages)('%s', async (_name, path, mock, ready) => {
    mock();
    await renderApp(path);
    await screen.findByText(ready);

    await expectNoA11yViolations();
  });
});

describe('dialogs', () => {
  async function renderDashboard() {
    mockDashboardApi({ accounts, transactions });
    await renderApp('/accounts/a1');
    await screen.findByText('Salary');
    return userEvent.setup();
  }

  it('add transaction: accessible, moves focus inside, and gives it back on Escape', async () => {
    const user = await renderDashboard();
    const trigger = screen.getByRole('button', { name: 'Add transaction' });

    await user.click(trigger);
    const dialog = await screen.findByRole('dialog', { name: 'Add transaction' });

    expect(dialog).toContainElement(document.activeElement as HTMLElement);
    await expectNoA11yViolations(dialog);

    await user.keyboard('{Escape}');

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(trigger).toHaveFocus();
  });

  it('delete transaction: accessible, and Escape closes it without deleting', async () => {
    const user = await renderDashboard();
    let deleted = false;
    server.use(
      http.delete(apiUrl('/transactions/:id'), () => {
        deleted = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );

    await user.click(screen.getByRole('button', { name: 'Delete transaction' }));
    const dialog = await screen.findByRole('alertdialog', { name: 'Delete transaction?' });
    await expectNoA11yViolations(dialog);

    await user.keyboard('{Escape}');

    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(deleted).toBe(false);
  });

  it('delete account: focuses the confirmation field and submits it with Enter', async () => {
    const user = await renderDashboard();
    let deletedId: string | undefined;
    server.use(
      http.delete(apiUrl('/accounts/:id'), ({ params }) => {
        deletedId = params.id as string;
        return new HttpResponse(null, { status: 204 });
      }),
    );

    await user.click(await screen.findByRole('button', { name: 'Cash' }));
    await user.click(await screen.findByRole('button', { name: 'Delete Bank' }));
    const dialog = await screen.findByRole('alertdialog');
    const confirm = within(dialog).getByLabelText(/to confirm/);

    expect(confirm).toHaveFocus();
    await expectNoA11yViolations(dialog);

    await user.type(confirm, 'Bank{Enter}');

    await waitFor(() => expect(deletedId).toBe('a2'));
  });
});

describe('forms', () => {
  it('login can be submitted from the keyboard', async () => {
    let body: unknown;
    server.use(
      http.post(apiUrl('/auth/login'), async ({ request }) => {
        body = await request.json();
        return HttpResponse.json(authPayload(verifiedUser));
      }),
    );
    mockDashboardApi();
    await renderApp('/login');
    const user = userEvent.setup();

    await user.type(await screen.findByLabelText('Email'), 'jane@example.com');
    await user.type(screen.getByLabelText('Password'), 'password123{Enter}');

    await waitFor(() =>
      expect(body).toEqual({ email: 'jane@example.com', password: 'password123' }),
    );
  });

  it('announces field errors to assistive technology', async () => {
    server.use(
      http.post(apiUrl('/auth/login'), () =>
        validationError({ password: 'Password must be at least 8 characters' }),
      ),
    );
    await renderApp('/login');
    const user = userEvent.setup();

    await user.type(await screen.findByLabelText('Email'), 'jane@example.com');
    await user.type(screen.getByLabelText('Password'), 'short{Enter}');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Password must be at least 8 characters',
    );
  });

  it('flags a password mismatch as invalid and announces it', async () => {
    server.use(
      http.post(
        apiUrl('/auth/verify-password-reset'),
        () => new HttpResponse(null, { status: 204 }),
      ),
    );
    await renderApp('/reset-password?token=abc');
    const user = userEvent.setup();

    await user.type(await screen.findByLabelText('New password'), 'new-password-1');
    await user.type(screen.getByLabelText('Confirm new password'), 'different');

    expect(screen.getByLabelText('Confirm new password')).toBeInvalid();
    expect(screen.getByRole('alert')).toHaveTextContent("Passwords don't match");
  });
});

describe('loading states', () => {
  it('are announced politely with a status role', () => {
    render(<AuthPending title="Verifying link…" />);

    const status = screen.getByRole('status');
    expect(status).toHaveAttribute('aria-live', 'polite');
    expect(status).toHaveTextContent('Verifying link…');
  });
});
