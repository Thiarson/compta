import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';

import * as schema from './schema/index.js';

export type Database = ReturnType<typeof createDatabase>;
export type DbTransaction = Parameters<Parameters<Database['db']['transaction']>[0]>[0];

export function createDatabase(connectionString: string) {
  const sql = postgres(connectionString);
  const db = drizzle(sql, { schema });

  return { db, sql };
}
