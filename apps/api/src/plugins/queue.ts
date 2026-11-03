import { Queue } from 'bullmq';
import { Redis } from 'ioredis';
import fp from 'fastify-plugin';

import { EMAIL_JOB_ATTEMPTS, EMAIL_JOB_BACKOFF, EMAIL_QUEUE } from '../constants/queue.js';

import type { EmailJob } from '../constants/queue.js';

declare module 'fastify' {
  interface FastifyInstance {
    emailQueue: Queue<EmailJob>;
  }
}

export default fp(async function queuePlugin(app) {
  const connection = new Redis(app.config.REDIS_URL, {
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
  });
  connection.on('error', (err) => app.log.error({ err }, 'queue: Redis connection error'));

  const emailQueue = new Queue<EmailJob>(EMAIL_QUEUE, {
    connection,
    defaultJobOptions: {
      removeOnComplete: { age: 3600 }, // jobs carry tokens: don't keep them around
      removeOnFail: { age: 7 * 24 * 3600 }, // keep failures for debugging / replay
      attempts: EMAIL_JOB_ATTEMPTS,
      backoff: EMAIL_JOB_BACKOFF,
    },
  });

  emailQueue.on('error', (err) => app.log.error({ err }, 'queue: email queue error'));

  app.decorate('emailQueue', emailQueue);

  app.addHook('onClose', async () => {
    await emailQueue.close();
    connection.disconnect();
  });
});
