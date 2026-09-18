import { vi } from 'vitest';
import { sql } from 'drizzle-orm';
import buildServer from '../../src/app.js';

export async function buildTestApp() {
  const app = await buildServer({ logger: false });
  await app.ready();
  // Never call Resend; capture emails so tests can read the tokens in them
  const sendEmail = vi.spyOn(app.email, 'sendEmail').mockResolvedValue();
  return { app, sendEmail };
}

export async function resetDb(app: Awaited<ReturnType<typeof buildServer>>) {
  // every table cascades from users
  await app.db.execute(sql`TRUNCATE users CASCADE`);
}

export function tokenFromEmail(body: string) {
  return body.match(/token=([a-f0-9]{64})/)![1];
}
