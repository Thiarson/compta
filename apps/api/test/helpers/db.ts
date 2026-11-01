import { sql } from 'drizzle-orm';
import { onTestFinished } from 'vitest';

import type { TestApp } from './app.js';

/**
 * Makes every `operation` on `table` fail with a real database error until the current test
 * ends (via a Postgres trigger), to check that multi-step writes roll back as a whole.
 */
export async function failWritesTo(
  app: TestApp,
  table: 'accounts' | 'transactions',
  operation: 'INSERT' | 'UPDATE',
) {
  await app.db.execute(sql`
    CREATE OR REPLACE FUNCTION test_simulated_failure() RETURNS trigger LANGUAGE plpgsql
    AS $$ BEGIN RAISE EXCEPTION 'simulated failure'; END $$
  `);
  // identifiers can't be bound parameters; both come from the literal types above
  await app.db.execute(
    sql.raw(
      `CREATE TRIGGER test_simulated_failure BEFORE ${operation} ON ${table}
       FOR EACH ROW EXECUTE FUNCTION test_simulated_failure()`,
    ),
  );
  onTestFinished(async () => {
    await app.db.execute(sql`DROP FUNCTION test_simulated_failure() CASCADE`);
  });
}
