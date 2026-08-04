import { createFileRoute, redirect } from '@tanstack/react-router';
import { SignupPage } from '@/pages/Signup';
import { sessionQueryOptions } from '@/features/auth/auth.queries';
import { validateAuthSearch } from '@/features/auth/auth.search';

export const Route = createFileRoute('/signup')({
  validateSearch: validateAuthSearch,
  beforeLoad: ({ context, search }) => {
    if (context.queryClient.getQueryData(sessionQueryOptions.queryKey)) {
      throw redirect({ to: search.redirect ?? '/' });
    }
  },
  component: SignupPage,
});
