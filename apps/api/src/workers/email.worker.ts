import { Redis } from 'ioredis';
import escapeHtml from 'escape-html';
import { UnrecoverableError, Worker } from 'bullmq';

import { EMAIL_QUEUE } from '../constants/queue.js';
import { EmailSendError } from '../utils/email-error.js';

import type { Job } from 'bullmq';
import type { FastifyInstance } from 'fastify';
import type { EmailJob } from '../constants/queue.js';
import type { EmailProvider } from '../plugins/email.js';

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

export async function processEmailJob(email: EmailProvider, job: Job<EmailJob>) {
  // The job id doubles as the provider's idempotency key, so a re-delivered job can't send twice
  if (!job.id) throw new UnrecoverableError('email job has no id');

  const { subject, html } = renderEmail(job.data);

  try {
    await email.sendEmail(job.data.to, subject, html, job.id);
  } catch (err) {
    // Permanent failure: retrying can't help, so skip the remaining attempts
    if (err instanceof EmailSendError && !err.retryable) {
      throw new UnrecoverableError(err.message);
    }
    throw err;
  }
}

export function startEmailWorker(app: FastifyInstance) {
  // `null` makes the worker keep retrying through a Redis outage instead of erroring.
  const connection = new Redis(app.config.REDIS_URL, { maxRetriesPerRequest: null });
  connection.on('error', (err) => app.log.error({ err }, 'worker: Redis connection error'));

  const worker = new Worker<EmailJob>(EMAIL_QUEUE, (job) => processEmailJob(app.email, job), {
    connection,
    concurrency: 5,
  });

  worker.on('error', (err) => app.log.error({ err }, 'worker: email error'));
  worker.on('failed', (job, err) => {
    if (!job) return;

    const fields = { err, jobId: job.id, template: job.data.template, attempt: job.attemptsMade };
    const retriesLeft = job.attemptsMade < (job.opts.attempts ?? 1);

    if (retriesLeft && !(err instanceof UnrecoverableError)) {
      app.log.warn(fields, 'worker: email failed, will retry');
    } else {
      app.log.error(fields, 'worker: email failed permanently');
    }
  });

  app.addHook('onClose', async () => {
    await worker.close(); // waits for in-flight jobs
    connection.disconnect();
  });

  return worker;
}
