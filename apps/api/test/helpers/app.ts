import { afterAll, afterEach, beforeAll, beforeEach, vi } from 'vitest';
import { sql } from 'drizzle-orm';
import buildServer from '../../src/app.js';

export type TestApp = Awaited<ReturnType<typeof buildServer>>;

export async function buildTestApp() {
  const app = await buildServer({ logger: false });
  await app.ready();
  // Never call Resend; capture emails so tests can read the tokens in them
  const sendEmail = vi.spyOn(app.email, 'sendEmail').mockResolvedValue();
  return { app, sendEmail };
}

export async function resetDb(app: TestApp) {
  // explicit table list: `TRUNCATE users CASCADE` prints a NOTICE per cascaded table
  await app.db.execute(
    sql`TRUNCATE users, accounts, transactions, refresh_tokens, email_verification_tokens, password_reset_tokens`,
  );
}

export function tokenFromEmail(body: string) {
  return body.match(/token=([a-f0-9]{64})/)![1];
}

/** The token embedded in the most recent email passed to `sendEmail`. */
export function lastEmailToken(sendEmail: { mock: { lastCall?: unknown[] } }) {
  const lastCall = sendEmail.mock.lastCall;
  if (!lastCall) throw new Error('No email was sent');
  return tokenFromEmail(lastCall[2] as string);
}

/**
 * Boots one app per test file, empties the database before each test and
 * clears the captured emails. Returns the context the tests read from.
 */
export function setupTestApp() {
  const ctx = {} as Awaited<ReturnType<typeof buildTestApp>>;

  beforeAll(async () => {
    Object.assign(ctx, await buildTestApp());
  });
  afterAll(async () => {
    await ctx.app.close();
  });
  beforeEach(async () => {
    await resetDb(ctx.app);
    ctx.sendEmail.mockClear();
  });
  afterEach(() => {
    vi.useRealTimers(); // undoes any `vi.setSystemTime` a test used
  });

  return ctx;
}
