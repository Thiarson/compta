import fp from 'fastify-plugin';
import type { FastifyInstance } from 'fastify';

function healthRoute(app: FastifyInstance) {
  // Basic liveness check
  app.get('/healthz', () => {
    return {
      status: 'ok',
      uptime: process.uptime(),
    };
  });
}

export default fp(healthRoute);
