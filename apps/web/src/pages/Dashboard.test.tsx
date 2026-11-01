import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { apiError, apiUrl, mockAccounts, mockSession, verifiedUser } from '@/test/handlers';
import { renderApp } from '@/test/render';
import { server } from '@/test/server';

import type { AllTransactionResponse } from '@compta/contracts';

const accounts = [
  { id: 'a1', category: 'Cash' },
  { id: 'a2', category: 'Bank' },
];

const tx = (
  id: string,
  accountId: string,
  type: 'income' | 'expense',
  amount: number,
  description: string,
  date: string,
): AllTransactionResponse[number] => ({
  id,
  accountId,
  type,
  amount,
  description,
  date,
  createdAt: '2025-06-01T00:00:00.000Z',
});

const transactions = [
  tx('t1', 'a1', 'income', 10000, 'Salary', '2025-06-15'),
  tx('t2', 'a1', 'expense', 2500, 'Groceries', '2025-06-15'),
  tx('t3', 'a1', 'expense', 1000, 'Bus', '2025-06-10'),
  tx('t4', 'a2', 'income', 99999, 'Other account', '2025-06-15'),
];

// Serves a mutable transaction list and records what the page sends.
function mockTransactionStore(initial: AllTransactionResponse) {
  const store = { list: initial, posted: [] as unknown[], deleted: [] as string[] };
  server.use(
    http.get(apiUrl('/transactions'), () => HttpResponse.json(store.list)),
    http.post(apiUrl('/transactions'), async ({ request }) => {
      const body = (await request.json()) as Omit<
        AllTransactionResponse[number],
        'id' | 'createdAt'
      >;
      store.posted.push(body);
      const created = { ...body, id: 't-new', createdAt: '2025-06-15T00:00:00.000Z' };
      store.list = [...store.list, created];
      return HttpResponse.json(created, { status: 201 });
    }),
    http.delete(apiUrl('/transactions/:id'), ({ params }) => {
      store.deleted.push(params.id as string);
      store.list = store.list.filter((transaction) => transaction.id !== params.id);
      return new HttpResponse(null, { status: 204 });
    }),
  );
  return store;
}

async function renderDashboard(initial = transactions, path = '/accounts/a1') {
  mockSession(verifiedUser);
  mockAccounts(accounts);
  const store = mockTransactionStore(initial);
  const app = await renderApp(path);
  return { ...app, store, user: userEvent.setup() };
}

beforeEach(() => {
  // "today" is 15 June 2025; only Date is faked so timers, MSW and queries keep working
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2025, 5, 15, 12, 0));
});
afterEach(() => vi.useRealTimers());

describe('Dashboard summary', () => {
  it('totals the active account only', async () => {
    await renderDashboard();

    // income 10 000, expense 2 500 + 1 000; the other account's 99 999 is excluded
    expect(await screen.findByText('6 500 Ar')).toBeInTheDocument();
    expect(screen.getByText('10 000 Ar')).toBeInTheDocument();
    expect(screen.getByText('3 500 Ar')).toBeInTheDocument();
  });

  it('shows a negative balance as such', async () => {
    // dated another day, so only the balance card shows the amount
    await renderDashboard([tx('t1', 'a1', 'expense', 500, 'Coffee', '2025-06-10')]);

    expect(await screen.findByText('-500 Ar')).toHaveClass('text-destructive');
  });

  it('switches totals and list when another account is opened', async () => {
    const { router } = await renderDashboard();
    await screen.findByText('Salary');

    await router.navigate({ to: '/accounts/$accountId', params: { accountId: 'a2' } });

    expect(await screen.findByText('Other account')).toBeInTheDocument();
    expect(screen.queryByText('Salary')).toBeNull();
    expect(screen.getAllByText('99 999 Ar')).not.toHaveLength(0);
  });
});

describe('Dashboard day list', () => {
  it("lists today's transactions of the active account with signed amounts", async () => {
    await renderDashboard();

    expect(await screen.findByText('Salary')).toBeInTheDocument();
    expect(screen.getByText('+10 000 Ar')).toBeInTheDocument();
    expect(screen.getByText('Groceries')).toBeInTheDocument();
    expect(screen.getByText('-2 500 Ar')).toBeInTheDocument();
    expect(screen.getByText('Today')).toBeInTheDocument();
    // other day, other account
    expect(screen.queryByText('Bus')).toBeNull();
    expect(screen.queryByText('Other account')).toBeNull();
  });

  it('says so when nothing was recorded today', async () => {
    await renderDashboard([]);

    expect(await screen.findByText('No transactions recorded today yet.')).toBeInTheDocument();
  });

  it('shows another day from the calendar, and returns to today', async () => {
    const { user } = await renderDashboard();
    await screen.findByText('Salary');

    await user.click(screen.getByRole('button', { name: /June 10th, 2025/ }));

    expect(await screen.findByText('Bus')).toBeInTheDocument();
    expect(screen.getByText('Tuesday, June 10')).toBeInTheDocument();
    expect(screen.queryByText('Salary')).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Today' }));

    expect(await screen.findByText('Salary')).toBeInTheDocument();
    expect(screen.queryByText('Bus')).toBeNull();
  });

  it('says so when nothing was recorded on the chosen day', async () => {
    const { user } = await renderDashboard();
    await screen.findByText('Salary');

    await user.click(screen.getByRole('button', { name: /June 11th, 2025/ }));

    expect(await screen.findByText('No transactions recorded on this day.')).toBeInTheDocument();
  });
});

describe('Adding a transaction', () => {
  async function addExpense(
    user: ReturnType<typeof userEvent.setup>,
    amount: string,
    text: string,
  ) {
    await user.click(screen.getByRole('button', { name: 'Add transaction' }));
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText('Amount (Ar)'), amount);
    await user.type(within(dialog).getByLabelText('Description'), text);
    await user.click(within(dialog).getByRole('button', { name: 'Add transaction' }));
  }

  it('posts it for the active account and shows it in the list', async () => {
    const { user, store } = await renderDashboard();
    await screen.findByText('Salary');

    await addExpense(user, '700', 'Taxi');

    expect(await screen.findByText('Taxi')).toBeInTheDocument();
    expect(store.posted).toEqual([
      { accountId: 'a1', type: 'expense', amount: 700, description: 'Taxi', date: '2025-06-15' },
    ]);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('records it on the day selected in the calendar', async () => {
    const { user, store } = await renderDashboard();
    await screen.findByText('Salary');
    await user.click(screen.getByRole('button', { name: /June 10th, 2025/ }));

    await addExpense(user, '700', 'Taxi');

    expect(await screen.findByText('Taxi')).toBeInTheDocument();
    expect(store.posted).toEqual([expect.objectContaining({ date: '2025-06-10' })]);
  });

  it('shows the API message when saving fails', async () => {
    const { user } = await renderDashboard();
    await screen.findByText('Salary');
    server.use(
      http.post(apiUrl('/transactions'), () =>
        apiError(400, 'VALIDATION_ERROR', 'Amount is too large'),
      ),
    );

    await addExpense(user, '700', 'Taxi');

    expect(await screen.findByText('Amount is too large')).toBeInTheDocument();
  });
});

describe('Deleting a transaction', () => {
  async function openDeleteDialog(user: ReturnType<typeof userEvent.setup>, description: string) {
    const row = (await screen.findByText(description)).closest('tr')!;
    await user.click(within(row).getByRole('button', { name: 'Delete transaction' }));
    return screen.findByRole('alertdialog');
  }

  it('removes it after confirmation', async () => {
    const { user, store } = await renderDashboard();

    const dialog = await openDeleteDialog(user, 'Groceries');
    expect(within(dialog).getByText(/“Groceries”/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(screen.queryByText('Groceries')).toBeNull());
    expect(store.deleted).toEqual(['t2']);
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it('keeps it when the user cancels', async () => {
    const { user, store } = await renderDashboard();

    const dialog = await openDeleteDialog(user, 'Groceries');
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));

    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(screen.getByText('Groceries')).toBeInTheDocument();
    expect(store.deleted).toEqual([]);
  });

  it('keeps the dialog open and explains when deleting fails', async () => {
    const { user } = await renderDashboard();
    server.use(
      http.delete(apiUrl('/transactions/t2'), () =>
        apiError(404, 'NOT_FOUND', 'Transaction not found'),
      ),
    );

    const dialog = await openDeleteDialog(user, 'Groceries');
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }));

    expect(await within(dialog).findByText('Transaction not found')).toBeInTheDocument();
    expect(screen.getByText('Groceries')).toBeInTheDocument();
  });
});
