import { createFileRoute, redirect } from '@tanstack/react-router';
import { accountQueryOptions } from '@/features/account/account.hooks';

import DashboardPage from '@/pages/Dashboard';

// Without an account in the URL, send the user to their first account.
// With no accounts at all, render the dashboard's empty state.
export const Route = createFileRoute('/_authenticated/')({
  beforeLoad: async ({ context }) => {
    const accounts = await context.queryClient.ensureQueryData(accountQueryOptions);
    if (accounts.length > 0) {
      throw redirect({
        to: '/accounts/$accountId',
        params: { accountId: accounts[0].id },
        replace: true,
      });
    }
  },
  component: DashboardPage,
});
