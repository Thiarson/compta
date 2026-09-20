import { createFileRoute, redirect } from '@tanstack/react-router';
import { accountQueryOptions } from '@/features/account/account.hooks';

import DashboardPage from '@/pages/Dashboard';

export const Route = createFileRoute('/_authenticated/accounts/$accountId')({
  beforeLoad: async ({ context, params }) => {
    const accounts = await context.queryClient.ensureQueryData(accountQueryOptions);
    if (!accounts.some((account) => account.id === params.accountId)) {
      throw redirect({ to: '/', replace: true });
    }
  },
  component: DashboardPage,
});
