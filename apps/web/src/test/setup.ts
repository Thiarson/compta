import '@testing-library/jest-dom/vitest';

import { cleanup } from '@testing-library/react';
import { afterAll, afterEach, beforeAll } from 'vitest';

import { setAccessToken } from '@/lib/auth-token';

import { server } from './server';

// The router calls scrollTo on navigation; jsdom only logs "not implemented".
window.scrollTo = () => {};

// jsdom has no matchMedia; Sonner's Toaster and use-mobile both call it.
window.matchMedia ??= (query: string) =>
  ({
    matches: false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }) as unknown as MediaQueryList;

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));

afterEach(() => {
  cleanup();
  server.resetHandlers();
  setAccessToken(null);
});

afterAll(() => server.close());
