import { execFileSync, spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { PostgreSqlContainer } from '@testcontainers/postgresql';

import { API_ORIGIN, API_PORT, MAIL_PORT, MAIL_URL, WEB_URL } from './support/env';
import { startMailServer } from './support/mail-server';

async function waitForApi(timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      if ((await fetch(`${API_ORIGIN}/healthz`)).ok) return;
    } catch {
      // not listening yet
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`The API did not become ready at ${API_ORIGIN} within ${timeoutMs}ms`);
}

// Starts everything the browser tests talk to: a throwaway Postgres, the real API,
// and a fake Resend. The web app itself is started by `webServer` in playwright.config.ts.
export default async function globalSetup() {
  const database = await new PostgreSqlContainer('postgres:17-alpine').start();
  const databaseUrl = database.getConnectionUri();

  execFileSync('pnpm', ['--filter', '@compta/db', 'db:migrate'], {
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: ['ignore', 'ignore', 'inherit'],
  });

  const stopMailServer = await startMailServer(MAIL_PORT);

  const api = spawn(process.execPath, ['--import', 'tsx', 'src/server.ts'], {
    cwd: fileURLToPath(new URL('../../api', import.meta.url)),
    stdio: ['ignore', 'ignore', 'inherit'],
    env: {
      ...process.env,
      NODE_ENV: 'development',
      HOST: '127.0.0.1',
      PORT: String(API_PORT),
      APP_URL: WEB_URL,
      ALLOWED_ORIGINS: WEB_URL,
      DATABASE_URL: databaseUrl,
      REDIS_URL: '', // empty → in-memory rate limit store
      JWT_ACCESS_TOKEN_SECRET: 'e2e-access-secret-at-least-32-chars!!!',
      JWT_REFRESH_TOKEN_SECRET: 'e2e-refresh-secret-at-least-32-chars!!',
      EMAIL_FROM: 'e2e@compta.dev',
      EMAIL_API_KEY: 're_e2e_dummy',
      RESEND_BASE_URL: MAIL_URL,
    },
  });

  await waitForApi();

  return async () => {
    api.kill('SIGTERM');
    await stopMailServer();
    await database.stop();
  };
}
