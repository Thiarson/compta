import { createFileRoute } from '@tanstack/react-router';
import { validateAccountSearch } from '@/features/account/account.search';

import DashboardPage from '@/pages/Dashboard';

export const Route = createFileRoute('/_authenticated/')({
  validateSearch: validateAccountSearch,
  component: DashboardPage,
});
