import { defineConfig, devices } from '@playwright/test';

import { API_ORIGIN, WEB_PORT, WEB_URL } from './test/e2e/support/env';

export default defineConfig({
  testDir: './test/e2e',
  globalSetup: './test/e2e/global-setup.ts',
  // One worker, in order: the API rate-limits auth routes per IP (5 registrations / 10 min,
  // 10 logins / min), and every test shares 127.0.0.1. See test/e2e/support/api.ts.
  workers: 1,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: WEB_URL,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    // The production build, as users get it (no dev overlays), pointed at the E2E API.
    command: `pnpm exec vite build && pnpm exec vite preview --port ${WEB_PORT} --strictPort`,
    url: WEB_URL,
    env: { VITE_API_URL: API_ORIGIN },
    timeout: 120_000,
  },
});
