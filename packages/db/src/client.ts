import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';

import * as schema from './schema/index.js';

export type Database = ReturnType<typeof createDatabase>;

export function createDatabase(connectionString: string) {
  const sql = postgres(connectionString);
  const db = drizzle(sql, { schema });

  return { db, sql };
}
