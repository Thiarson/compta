import { render, renderHook, waitFor } from '@testing-library/react';
import { expect } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  RouterContextProvider,
  RouterProvider,
  createMemoryHistory,
  createRouter,
} from '@tanstack/react-router';

import { routeTree } from '@/routeTree.gen';

import type { ReactNode } from 'react';

// A fresh QueryClient and router per test, so no cache or navigation state leaks between tests.
function createTestContext(path: string) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const router = createRouter({
    routeTree,
    context: { queryClient },
    history: createMemoryHistory({ initialEntries: [path] }),
  });

  return { queryClient, router };
}

// Renders the real route tree at `path`, so guards, loaders and pages run as in the app.
export async function renderApp(path = '/') {
  const { queryClient, router } = createTestContext(path);

  // RouterProvider runs the initial load itself; loading here too would run every loader twice.
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  await waitFor(() => expect(router.state.status).toBe('idle'));
  await waitFor(() => expect(router.state.resolvedLocation).toBeDefined());

  return { router, queryClient };
}

// For hooks that need the query client and/or router context but no rendered routes.
export function renderHookWithProviders<T>(hook: () => T) {
  const { queryClient, router } = createTestContext('/');

  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <RouterContextProvider router={router}>{children}</RouterContextProvider>
    </QueryClientProvider>
  );

  return { ...renderHook(hook, { wrapper }), queryClient, router };
}
