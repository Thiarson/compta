import { ApiError } from '@/lib/api-error';
import { authApi } from '@/features/auth/auth.api';
import { VerifyEmailPage } from '@/pages/VerifyEmail';
import { VerifyingEmail } from '@/components/auth/verify-email';
import { sessionQueryOptions } from '@/features/auth/auth.queries';
import { createFileRoute, redirect } from '@tanstack/react-router';
import { validateVerifyEmailSearch } from '@/features/auth/auth.search';

import type { MeResponse } from '@compta/contracts';

// Verification runs in the loader, not a component effect,
// so it fires exactly once per navigation instead of racing React's mount/unmount lifecycle.
export type VerifyEmailResult =
  | { status: 'success'; sessionUser: MeResponse | null }
  | { status: 'error'; message: string; sessionUser: MeResponse | null };

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
  loaderDeps: ({ search }) => ({ token: search.token }),
  loader: async ({ context, deps }): Promise<VerifyEmailResult | null> => {
    if (!deps.token) return null;

    let verifyError: unknown = null;
    try {
      await authApi.verifyEmail({ verificationToken: deps.token });
    } catch (error) {
      verifyError = error;
    }

    const sessionUser = await context.queryClient.fetchQuery(sessionQueryOptions).catch(() => null);

    if (verifyError) {
      return {
        status: 'error',
        message:
          verifyError instanceof ApiError
            ? verifyError.message
            : 'This link is invalid or has expired.',
        sessionUser,
      };
    }

    return { status: 'success', sessionUser };
  },
  pendingComponent: VerifyingEmail,
  pendingMs: 0,
  pendingMinMs: 0,
  component: VerifyEmailPage,
});
