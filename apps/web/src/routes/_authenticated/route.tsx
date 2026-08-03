import { createFileRoute, Outlet, redirect } from '@tanstack/react-router';
import { sessionQueryOptions } from '@/features/auth/auth.queries';

export const Route = createFileRoute('/_authenticated')({
  beforeLoad: async ({ context, location }) => {
    try {
      await context.queryClient.ensureQueryData(sessionQueryOptions);
    } catch {
      throw redirect({
        to: '/login',
        search: { redirect: location.href },
      });
    }
  },
  component: () => <Outlet />,
});
