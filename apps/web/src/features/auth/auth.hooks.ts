import { useRouter } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { authApi } from './auth.api';
import { authKeys } from './auth.keys';
import { sessionQueryOptions } from './auth.queries';
import { setAccessToken } from '../../lib/auth-token';

import type { AuthResponse, VerifyEmailBody } from '@compta/contracts';

export function useSession() {
  return useQuery(sessionQueryOptions);
}

function useAuthSuccess() {
  const queryClient = useQueryClient();

  return (data: AuthResponse) => {
    setAccessToken(data.accessToken);
    queryClient.setQueryData(authKeys.session(), data.user);
  };
}

export function useLogin() {
  const onAuthSuccess = useAuthSuccess();

  return useMutation({
    mutationFn: authApi.login,
    onSuccess: onAuthSuccess,
  });
}

export function useRegister() {
  const onAuthSuccess = useAuthSuccess();

  return useMutation({
    mutationFn: authApi.register,
    onSuccess: onAuthSuccess,
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: authApi.logout,
    onSuccess: () => {
      setAccessToken(null);
      // drop, don't invalidate: there's no session to refetch after logout
      queryClient.removeQueries({ queryKey: authKeys.all });
      router.navigate({ to: '/login' });
    },
  });
}

// Returns the refreshed session (or null if this device has none)
// so callers know whether to continue in-app or send the user to log in.
export function useVerifyEmail() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (body: VerifyEmailBody) => {
      await authApi.verifyEmail(body);
      return queryClient.fetchQuery(sessionQueryOptions).catch(() => null);
    },
  });
}

export function useResendVerification() {
  return useMutation({ mutationFn: authApi.resendVerification });
}

export function useForgotPassword() {
  return useMutation({ mutationFn: authApi.forgotPassword });
}

export function useVerifyPasswordReset() {
  return useMutation({ mutationFn: authApi.verifyPasswordReset });
}

export function useResetPassword() {
  return useMutation({ mutationFn: authApi.resetPassword });
}
