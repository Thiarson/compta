import { afterAll, afterEach, beforeAll, beforeEach, vi } from 'vitest';
import { desc, eq, sql } from 'drizzle-orm';
import { notifications } from '@compta/db';
import buildServer from '../../src/app.js';
import { renderEmail } from '../../src/workers/email.worker.js';
import { publishPendingEvents } from '../../src/workers/event.relay.js';
import { buildEventsRepository } from '../../src/modules/notifications/events.repository.js';

export type TestApp = Awaited<ReturnType<typeof buildServer>>;

export async function buildTestApp() {
  const app = await buildServer({ logger: false });
  // Stand in for the relay's timer: publish what the request saved before its response is returned,
  // so tests can read the email right after a request
  const eventsRepository = buildEventsRepository(app.db);
  app.addHook('onSend', async (_request, _reply, payload) => {
    await publishPendingEvents(app.db, eventsRepository, app.emailQueue);
    return payload;
  });
  await app.ready();
  // Never call Resend; capture emails so tests can read the tokens in them
  const sendEmail = vi.spyOn(app.email, 'sendEmail').mockResolvedValue();
  // Stand in for the worker: render each enqueued job and "send" it right away
  vi.spyOn(app.emailQueue, 'add').mockImplementation(async (_name, job, opts) => {
    const { subject, html } = renderEmail(job);
    await app.email.sendEmail(job.to, subject, html, opts?.jobId ?? 'test-job');
    return {} as never;
  });
  return { app, sendEmail };
}

export async function resetDb(app: TestApp) {
  // explicit table list: `TRUNCATE users CASCADE` prints a NOTICE per cascaded table
  await app.db.execute(
    sql`TRUNCATE users, accounts, transactions, refresh_tokens, email_verification_tokens, password_reset_tokens, notifications, events`,
  );
}

/** The user's most recent notification row. Its id is the id of the queued email job. */
export async function latestNotification(app: TestApp, userId: string) {
  const [row] = await app.db
    .select()
    .from(notifications)
    .where(eq(notifications.userId, userId))
    .orderBy(desc(notifications.createdAt))
    .limit(1);
  return row;
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
