import { createFileRoute, redirect } from '@tanstack/react-router';
import { VerifyEmailPage } from '@/pages/VerifyEmail';
import { sessionQueryOptions } from '@/features/auth/auth.queries';
import { validateVerifyEmailSearch } from '@/features/auth/auth.search';

export const Route = createFileRoute('/verify-email')({
  validateSearch: validateVerifyEmailSearch,
  beforeLoad: async ({ context, search }) => {
    // A token means we got here from the emailed link, which must work
    // regardless of session state (e.g. a different device than signup).
    if (search.token) return;

    let user;
    try {
      user = await context.queryClient.ensureQueryData(sessionQueryOptions);
    } catch {
      throw redirect({ to: '/login', search: { redirect: search.redirect } });
    }

    if (user.emailVerifiedAt) {
      throw redirect({ to: search.redirect ?? '/' });
    }
  },
  component: VerifyEmailPage,
});
