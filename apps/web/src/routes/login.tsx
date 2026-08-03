import { createFileRoute, redirect } from '@tanstack/react-router';
import { LoginPage } from '@/pages/Login';
import { sessionQueryOptions } from '@/features/auth/auth.queries';

type LoginSearch = {
  redirect?: string;
};

export const Route = createFileRoute('/login')({
  validateSearch: (search: Record<string, unknown>): LoginSearch => ({
    redirect: typeof search.redirect === 'string' ? search.redirect : undefined,
  }),
  beforeLoad: ({ context, search }) => {
    if (context.queryClient.getQueryData(sessionQueryOptions.queryKey)) {
      throw redirect({ to: search.redirect ?? '/' });
    }
  },
  component: LoginPage,
});
