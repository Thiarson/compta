import { queryOptions } from '@tanstack/react-query';

import { authApi } from './auth.api';
import { authKeys } from './auth.keys';

// Shared between useSession() and router beforeLoad guards so both hit the same cache entry.
export const sessionQueryOptions = queryOptions({
  queryKey: authKeys.session(),
  queryFn: authApi.me,
  // no refresh cookie -> stay logged out, don't retry-storm apiFetch's own refresh attempt
  retry: false,
  // session only changes via login/register/refresh/logout, never by itself
  staleTime: Infinity,
});
