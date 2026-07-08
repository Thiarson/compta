import { Redis } from 'ioredis';
import fp from 'fastify-plugin';
import rateLimit from '@fastify/rate-limit';

export default fp(async function rateLimitPlugin(app) {
  let redis: Redis | undefined;

  if (app.config.REDIS_URL) {
    try {
      redis = new Redis(app.config.REDIS_URL, { connectTimeout: 500, maxRetriesPerRequest: 1 });
      redis.on('error', (err) => {
        app.log.error(
          { err },
          'rate-limit: Redis connection error, requests fall back to in-memory limiting',
        );
      });
    } catch (err) {
      app.log.error({ err }, 'rate-limit: invalid REDIS_URL, falling back to in-memory store');
      redis = undefined;
    }
  }

  app.log.info(
    redis
      ? 'rate-limit: using Redis store'
      : 'rate-limit: using in-memory store (REDIS_URL not set)',
  );

  await app.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
    redis,
  });
});
