import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 2 * 60 * 1000, // data considered fresh for 2min
      gcTime: 10 * 60 * 1000, // unused cache kept for 10min
      retry: 1,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 0, // never auto-retry writes
    },
  },
});
