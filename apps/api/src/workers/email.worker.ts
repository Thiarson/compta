import { Worker } from 'bullmq';
import { Redis } from 'ioredis';
import escapeHtml from 'escape-html';

import { EMAIL_QUEUE } from '../constants/queue.js';

import type { FastifyInstance } from 'fastify';
import type { EmailJob } from '../constants/queue.js';

const templates = {
  'verify-email': ({ username, url }: EmailJob['params']) => ({
    subject: 'Verify your Compta email',
    html: `
      <p>Hi ${escapeHtml(username)},</p>
      <p>Click the link below to verify your email address. This link expires in 8 hours.</p>
      <p><a href="${url}">Verify my email</a></p>
      <p>Or copy this URL into your browser:<br>${url}</p>
      <p>If you didn't create an account, you can ignore this email.</p>
    `,
  }),
  'reset-password': ({ username, url }: EmailJob['params']) => ({
    subject: 'Reset your Compta password',
    html: `
      <p>Hi ${escapeHtml(username)},</p>
      <p>Click the link below to reset your password. This link expires in 30 minutes.</p>
      <p><a href="${url}">Reset my password</a></p>
      <p>Or copy this URL into your browser:<br>${url}</p>
      <p>If you didn't request a password reset, you can ignore this email.</p>
    `,
  }),
};

export function renderEmail({ template, params }: EmailJob) {
  return templates[template](params);
}

export function startEmailWorker(app: FastifyInstance) {
  // `null` makes the worker keep retrying through a Redis outage instead of erroring.
  const connection = new Redis(app.config.REDIS_URL, { maxRetriesPerRequest: null });
  connection.on('error', (err) => app.log.error({ err }, 'worker: Redis connection error'));

  const worker = new Worker<EmailJob>(
    EMAIL_QUEUE,
    async (job) => {
      const { subject, html } = renderEmail(job.data);
      await app.email.sendEmail(job.data.to, subject, html);
    },
    { connection, concurrency: 5 },
  );

  worker.on('error', (err) => app.log.error({ err }, 'worker: email error'));
  worker.on('failed', (job, err) => app.log.error({ err, jobId: job?.id }, 'worker: email failed'));

  app.addHook('onClose', async () => {
    await worker.close(); // waits for in-flight jobs
    connection.disconnect();
  });

  return worker;
}
