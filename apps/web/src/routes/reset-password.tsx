import { ApiError } from '@/lib/api-error';
import { authApi } from '@/features/auth/auth.api';
import { ResetPasswordPage } from '@/pages/ResetPassword';
import { createFileRoute } from '@tanstack/react-router';
import { VerifyingResetToken } from '@/components/auth/reset-password';
import { validateResetPasswordSearch } from '@/features/auth/auth.search';

// Verification runs in the loader, not a component effect,
// so it fires exactly once per navigation instead of racing React's mount/unmount lifecycle.
export type ResetPasswordResult =
  { status: 'valid'; token: string } | { status: 'invalid'; message: string };

export const Route = createFileRoute('/reset-password')({
  validateSearch: validateResetPasswordSearch,
  loaderDeps: ({ search }) => ({ token: search.token }),
  loader: async ({ deps }): Promise<ResetPasswordResult> => {
    if (!deps.token) {
      return { status: 'invalid', message: 'This password reset link is invalid.' };
    }

    try {
      await authApi.verifyPasswordReset({ passwordResetToken: deps.token });
      return { status: 'valid', token: deps.token };
    } catch (error) {
      return {
        status: 'invalid',
        message: error instanceof ApiError ? error.message : 'This link is invalid or has expired.',
      };
    }
  },
  pendingComponent: VerifyingResetToken,
  pendingMs: 0,
  pendingMinMs: 0,
  component: ResetPasswordPage,
});
