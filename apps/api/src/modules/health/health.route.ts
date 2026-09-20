import fp from 'fastify-plugin';
import { sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';

function healthRoute(app: FastifyInstance) {
  // Liveness: the process is up
  app.get('/healthz', () => {
    return {
      status: 'ok',
      uptime: process.uptime(),
    };
  });

  // Readiness: dependencies needed to serve traffic are reachable
  app.get('/readyz', async (request, reply) => {
    try {
      await app.db.execute(sql`select 1`);
      return { status: 'ok' };
    } catch (err) {
      request.log.error({ err }, 'readiness check failed');
      return reply.status(503).send({ status: 'unavailable' });
    }
  });
}

export default fp(healthRoute);
