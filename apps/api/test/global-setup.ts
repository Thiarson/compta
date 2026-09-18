import { fileURLToPath } from 'node:url';
import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { createDatabase } from '@compta/db';

import type { TestProject } from 'vitest/node';

declare module 'vitest' {
  export interface ProvidedContext {
    databaseUrl: string;
  }
}

export default async function setup(project: TestProject) {
  const container = await new PostgreSqlContainer('postgres:17-alpine').start();
  const url = container.getConnectionUri();

  const { db, sql } = createDatabase(url);
  await migrate(db, {
    migrationsFolder: fileURLToPath(new URL('../../../packages/db/drizzle', import.meta.url)),
  });
  await sql.end();

  project.provide('databaseUrl', url);

  return async () => {
    await container.stop();
  };
}
