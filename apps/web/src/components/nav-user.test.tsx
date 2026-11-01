import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { apiUrl, mockDashboardApi, verifiedUser } from '@/test/handlers';
import { renderApp } from '@/test/render';
import { server } from '@/test/server';

describe('NavUser', () => {
  it('shows who is signed in', async () => {
    mockDashboardApi({ accounts: [{ id: 'a1', category: 'Cash' }] });
    await renderApp('/accounts/a1');

    expect(await screen.findByText(verifiedUser.username)).toBeInTheDocument();
    expect(screen.getByText(verifiedUser.email)).toBeInTheDocument();
    expect(screen.getByText('J')).toBeInTheDocument();
  });

  it('logs out from the menu and goes to /login', async () => {
    mockDashboardApi({ accounts: [{ id: 'a1', category: 'Cash' }] });
    server.use(http.post(apiUrl('/auth/logout'), () => new HttpResponse(null, { status: 204 })));
    const { router } = await renderApp('/accounts/a1');
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: new RegExp(verifiedUser.email) }));
    const menu = await screen.findByRole('menu');
    await user.click(within(menu).getByRole('menuitem', { name: 'Log out' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
    expect(await screen.findByText('Signed out')).toBeInTheDocument();
  });
});
