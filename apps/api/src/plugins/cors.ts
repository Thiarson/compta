import fp from 'fastify-plugin';
import cors from '@fastify/cors';

export default fp(async function corsPlugin(app) {
  const origins = app.config.ALLOWED_ORIGINS.split(',').map((o) => o.trim());

  await app.register(cors, {
    origin: origins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });
});
