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
          'rate-limit: Redis connection error, only auth routes are refused until it recovers',
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

  app.addHook('onClose', async () => {
    redis?.disconnect();
  });

  await app.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
    redis,
    // If the store is down, skip limiting and keep serving requests.
    // Auth routes override this and block instead.
    skipOnError: true,
  });
});
