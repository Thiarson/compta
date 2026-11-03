import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import {
  apiError,
  apiUrl,
  mockSession,
  mockTransactions,
  verifiedUser,
} from '@test/helpers/handlers';
import { renderApp } from '@test/helpers/render';
import { server } from '@test/helpers/server';

import type { AllAccountsResponse } from '@compta/contracts';

const twoAccounts = [
  { id: 'a1', category: 'Cash' },
  { id: 'a2', category: 'Bank' },
];

// Serves a mutable account list and records what the switcher sends.
function mockAccountStore(initial: AllAccountsResponse) {
  const store = { list: initial, posted: [] as unknown[], deleted: [] as string[] };
  server.use(
    http.get(apiUrl('/accounts'), () => HttpResponse.json(store.list)),
    http.post(apiUrl('/accounts'), async ({ request }) => {
      const body = (await request.json()) as { category: string };
      store.posted.push(body);
      const created = { id: 'a3', category: body.category };
      store.list = [...store.list, created];
      return HttpResponse.json(created, { status: 201 });
    }),
    http.delete(apiUrl('/accounts/:id'), ({ params }) => {
      store.deleted.push(params.id as string);
      store.list = store.list.filter((account) => account.id !== params.id);
      return new HttpResponse(null, { status: 204 });
    }),
  );
  return store;
}

async function renderSwitcher(accounts = twoAccounts, path = '/accounts/a1') {
  mockSession(verifiedUser);
  mockTransactions();
  const store = mockAccountStore(accounts);
  const app = await renderApp(path);
  const user = userEvent.setup();
  return { ...app, store, user };
}

async function openMenu(user: ReturnType<typeof userEvent.setup>, activeName: string) {
  await user.click(await screen.findByRole('button', { name: activeName }));
  return screen.findByRole('menu');
}

describe('AccountSwitcher', () => {
  it('shows the active account and lists all accounts', async () => {
    const { user } = await renderSwitcher();

    const menu = await openMenu(user, 'Cash');

    expect(within(menu).getByRole('menuitem', { name: /Cash/ })).toBeInTheDocument();
    expect(within(menu).getByRole('menuitem', { name: /Bank/ })).toBeInTheDocument();
  });

  it('opens the chosen account', async () => {
    const { user, router } = await renderSwitcher();

    const menu = await openMenu(user, 'Cash');
    await user.click(within(menu).getByRole('menuitem', { name: /Bank/ }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/accounts/a2'));
    expect(await screen.findByRole('button', { name: 'Bank' })).toBeInTheDocument();
  });

  it('does not offer deleting the only account', async () => {
    const { user } = await renderSwitcher([{ id: 'a1', category: 'Cash' }]);

    const menu = await openMenu(user, 'Cash');

    expect(within(menu).queryByRole('button', { name: /Delete/ })).toBeNull();
  });
});

describe('Adding an account', () => {
  async function openAddDialog(user: ReturnType<typeof userEvent.setup>) {
    const menu = await openMenu(user, 'Cash');
    await user.click(within(menu).getByRole('menuitem', { name: /Add account/ }));
    return screen.findByRole('dialog');
  }

  it('creates the trimmed name, then opens the new account', async () => {
    const { user, store, router } = await renderSwitcher();

    const dialog = await openAddDialog(user);
    await user.type(within(dialog).getByLabelText('Account name'), '  Business  ');
    await user.click(within(dialog).getByRole('button', { name: 'Create account' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/accounts/a3'));
    expect(store.posted).toEqual([{ category: 'Business' }]);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(await screen.findByRole('button', { name: 'Business' })).toBeInTheDocument();
  });

  it('starts with an empty name the next time it opens', async () => {
    const { user } = await renderSwitcher();
    const dialog = await openAddDialog(user);
    await user.type(within(dialog).getByLabelText('Account name'), 'Business');
    await user.click(within(dialog).getByRole('button', { name: 'Create account' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());

    const menu = await openMenu(user, 'Business');
    await user.click(within(menu).getByRole('menuitem', { name: /Add account/ }));

    expect(await screen.findByLabelText('Account name')).toHaveValue('');
  });

  it('flags a name that is too short only once the user tries to create it', async () => {
    const { user, store } = await renderSwitcher();

    const dialog = await openAddDialog(user);
    await user.type(within(dialog).getByLabelText('Account name'), 'a');
    await user.click(within(dialog).getByRole('heading', { name: 'Add account' }));
    expect(within(dialog).queryByRole('alert')).toBeNull();

    await user.click(within(dialog).getByRole('button', { name: 'Create account' }));

    expect(
      await within(dialog).findByText('Account name must be at least 2 characters'),
    ).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Create account' })).toBeEnabled();
    expect(store.posted).toEqual([]);
  });

  it('clears the error as soon as the name becomes valid', async () => {
    const { user } = await renderSwitcher();
    const dialog = await openAddDialog(user);
    await user.click(within(dialog).getByRole('button', { name: 'Create account' }));
    expect(await within(dialog).findByRole('alert')).toBeInTheDocument();

    await user.type(within(dialog).getByLabelText('Account name'), 'Bank');

    expect(within(dialog).queryByRole('alert')).toBeNull();
  });

  it('rejects a blank name made only of spaces', async () => {
    const { user, store } = await renderSwitcher();

    const dialog = await openAddDialog(user);
    await user.type(within(dialog).getByLabelText('Account name'), '   ');
    await user.click(within(dialog).getByRole('button', { name: 'Create account' }));

    expect(
      await within(dialog).findByText('Account name must be at least 2 characters'),
    ).toBeInTheDocument();
    expect(store.posted).toEqual([]);
  });

  it('keeps the dialog open and shows the API message when creating fails', async () => {
    const { user, router } = await renderSwitcher();
    server.use(
      http.post(apiUrl('/accounts'), () =>
        apiError(409, 'CONFLICT', 'An account with this name already exists'),
      ),
    );

    const dialog = await openAddDialog(user);
    await user.type(within(dialog).getByLabelText('Account name'), 'Bank');
    await user.click(within(dialog).getByRole('button', { name: 'Create account' }));

    expect(
      await within(dialog).findByText('An account with this name already exists'),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/accounts/a1');
  });
});

describe('Deleting an account', () => {
  async function openDeleteDialog(user: ReturnType<typeof userEvent.setup>, name: string) {
    const menu = await openMenu(user, 'Cash');
    await user.click(within(menu).getByRole('button', { name: `Delete ${name}` }));
    return screen.findByRole('alertdialog');
  }

  it('needs the exact account name before it enables the button', async () => {
    const { user } = await renderSwitcher();

    const dialog = await openDeleteDialog(user, 'Bank');
    const confirm = within(dialog).getByRole('button', { name: 'Delete account' });
    expect(confirm).toBeDisabled();

    await user.type(within(dialog).getByLabelText(/to confirm/), 'bank');
    expect(confirm).toBeDisabled();

    await user.clear(within(dialog).getByLabelText(/to confirm/));
    await user.type(within(dialog).getByLabelText(/to confirm/), 'Bank');
    expect(confirm).toBeEnabled();
  });

  it('deletes another account and stays where it is', async () => {
    const { user, store, router } = await renderSwitcher();

    const dialog = await openDeleteDialog(user, 'Bank');
    await user.type(within(dialog).getByLabelText(/to confirm/), 'Bank');
    await user.click(within(dialog).getByRole('button', { name: 'Delete account' }));

    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(store.deleted).toEqual(['a2']);
    expect(router.state.location.pathname).toBe('/accounts/a1');
  });

  it('moves to another account when the open one is deleted', async () => {
    const { user, store, router } = await renderSwitcher();

    const dialog = await openDeleteDialog(user, 'Cash');
    await user.type(within(dialog).getByLabelText(/to confirm/), 'Cash');
    await user.click(within(dialog).getByRole('button', { name: 'Delete account' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/accounts/a2'));
    expect(store.deleted).toEqual(['a1']);
    expect(await screen.findByRole('button', { name: 'Bank' })).toBeInTheDocument();
  });

  it('keeps the dialog open and shows the API message when deleting fails', async () => {
    const { user } = await renderSwitcher();
    server.use(
      http.delete(apiUrl('/accounts/a2'), () =>
        apiError(409, 'CONFLICT', 'Account is being modified'),
      ),
    );

    const dialog = await openDeleteDialog(user, 'Bank');
    await user.type(within(dialog).getByLabelText(/to confirm/), 'Bank');
    await user.click(within(dialog).getByRole('button', { name: 'Delete account' }));

    expect(await within(dialog).findByText('Account is being modified')).toBeInTheDocument();
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
  });

  it('closes without deleting on Cancel', async () => {
    const { user, store } = await renderSwitcher();

    const dialog = await openDeleteDialog(user, 'Bank');
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));

    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(store.deleted).toEqual([]);
  });
});
