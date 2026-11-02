import { createFileRoute, Outlet, redirect } from '@tanstack/react-router';
import { ApiError } from '@/lib/api-error';
import { sessionQueryOptions } from '@/features/auth/auth.queries';

export const Route = createFileRoute('/_authenticated')({
  beforeLoad: async ({ context, location }) => {
    let user;
    try {
      user = await context.queryClient.ensureQueryData(sessionQueryOptions);
    } catch (error) {
      // Any other failure (API down, network error) must not look like a logout
      if (!(error instanceof ApiError && error.status === 401)) throw error;

      throw redirect({
        to: '/login',
        search: { redirect: location.href },
      });
    }

    if (!user.emailVerifiedAt) {
      throw redirect({
        to: '/verify-email',
        search: { redirect: location.href },
      });
    }
  },
  component: () => <Outlet />,
});
