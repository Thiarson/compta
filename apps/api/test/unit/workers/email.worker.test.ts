import { UnrecoverableError } from 'bullmq';
import { describe, expect, it, vi } from 'vitest';
import { processEmailJob, renderEmail } from '../../../src/workers/email.worker.js';
import { EmailSendError } from '../../../src/utils/email-error.js';

import type { Job } from 'bullmq';
import type { EmailJob } from '../../../src/constants/queue.js';
import type { EmailProvider } from '../../../src/plugins/email.js';
import type { buildNotificationsRepository } from '../../../src/modules/notifications/notifications.repository.js';

type NotificationsRepository = ReturnType<typeof buildNotificationsRepository>;

describe('renderEmail', () => {
  const params = { username: 'alice', url: 'http://app.test/x?token=abc' };

  it.each([
    ['verify-email', 'Verify your Compta email'],
    ['reset-password', 'Reset your Compta password'],
  ] as const)('renders the %s template', (template, subject) => {
    const email = renderEmail({ to: 'alice@test.dev', template, params });

    expect(email.subject).toBe(subject);
    expect(email.html).toContain('Hi alice,');
    expect(email.html).toContain(params.url);
  });

  it('escapes the username', () => {
    const { html } = renderEmail({
      to: 'a@test.dev',
      template: 'reset-password',
      params: { ...params, username: '<script>' },
    });

    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('<script>');
  });
});

describe('processEmailJob', () => {
  const data: EmailJob = {
    to: 'alice@test.dev',
    template: 'verify-email',
    params: { username: 'alice', url: 'http://app.test/x?token=abc' },
  };
  const job = { id: 'notification-1', data } as Job<EmailJob>;

  function buildDeps(sendEmail: (...args: string[]) => Promise<void> = async () => {}) {
    const email = { sendEmail: vi.fn(sendEmail) };
    const notifications = { updateStatus: vi.fn() };
    return {
      email,
      notifications,
      run: (jobToRun: Job<EmailJob> = job) =>
        processEmailJob(
          email as unknown as EmailProvider,
          notifications as unknown as NotificationsRepository,
          jobToRun,
        ),
    };
  }

  it('sends the rendered email, then marks the notification as sent', async () => {
    const { run, email, notifications } = buildDeps();

    await run();

    expect(email.sendEmail).toHaveBeenCalledExactlyOnceWith(
      'alice@test.dev',
      'Verify your Compta email',
      expect.stringContaining('Hi alice,'),
      'notification-1',
    );
    expect(notifications.updateStatus).toHaveBeenCalledExactlyOnceWith('notification-1', 'sent');
  });

  it('sends the same idempotency key every time a job is delivered', async () => {
    const { run, email } = buildDeps();

    await run();
    await run(); // e.g. redelivered after a worker crash

    expect(email.sendEmail.mock.calls.map((call) => call[3])).toEqual([
      'notification-1',
      'notification-1',
    ]);
  });

  it('fails permanently, without sending, when the job has no id', async () => {
    const { run, email } = buildDeps();

    await expect(run({ data } as Job<EmailJob>)).rejects.toBeInstanceOf(UnrecoverableError);
    expect(email.sendEmail).not.toHaveBeenCalled();
  });

  it('rethrows transient errors so the queue retries, leaving the notification pending', async () => {
    const failure = new EmailSendError('rate_limit_exceeded: slow down', true);
    const { run, notifications } = buildDeps(() => Promise.reject(failure));

    await expect(run()).rejects.toBe(failure);
    expect(notifications.updateStatus).not.toHaveBeenCalled();
  });

  it('rethrows unknown errors (network, timeout) so the queue retries', async () => {
    const failure = new Error('ECONNRESET');
    const { run } = buildDeps(() => Promise.reject(failure));

    await expect(run()).rejects.toBe(failure);
  });

  it('turns a permanent error into UnrecoverableError so retries are skipped', async () => {
    const failure = new EmailSendError('validation_error: Invalid `to` field', false);
    const { run } = buildDeps(() => Promise.reject(failure));

    await expect(run()).rejects.toBeInstanceOf(UnrecoverableError);
  });
});
