import { createFileRoute, redirect } from '@tanstack/react-router';
import { LoginPage } from '@/pages/Login';
import { sessionQueryOptions } from '@/features/auth/auth.queries';
import { validateAuthSearch } from '@/features/auth/auth.search';

export const Route = createFileRoute('/login')({
  validateSearch: validateAuthSearch,
  beforeLoad: ({ context, search }) => {
    if (context.queryClient.getQueryData(sessionQueryOptions.queryKey)) {
      throw redirect({ to: search.redirect ?? '/' });
    }
  },
  component: LoginPage,
});
