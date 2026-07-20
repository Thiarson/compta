import fp from 'fastify-plugin';
import { createDatabase } from '@compta/db';

import type { Database } from '@compta/db';

declare module 'fastify' {
  interface FastifyInstance {
    db: Database['db'];
  }
}

export default fp(async function dbPlugin(app) {
  const { db, sql } = createDatabase(app.config.DATABASE_URL);

  app.decorate('db', db);

  app.addHook('onClose', async () => {
    await sql.end();
  });
});
