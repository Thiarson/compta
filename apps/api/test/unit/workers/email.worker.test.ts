import { UnrecoverableError } from 'bullmq';
import { describe, expect, it, vi } from 'vitest';
import { processEmailJob, renderEmail } from '../../../src/workers/email.worker.js';
import { EmailSendError } from '../../../src/utils/email-error.js';

import type { Job } from 'bullmq';
import type { EmailJob } from '../../../src/constants/queue.js';
import type { EmailProvider } from '../../../src/plugins/email.js';

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
  const job = { data } as Job<EmailJob>;

  function providerThat(sendEmail: () => Promise<void>) {
    return { sendEmail: vi.fn(sendEmail) } as unknown as EmailProvider & {
      sendEmail: ReturnType<typeof vi.fn>;
    };
  }

  it('sends the rendered email', async () => {
    const email = providerThat(async () => {});

    await processEmailJob(email, job);

    expect(email.sendEmail).toHaveBeenCalledExactlyOnceWith(
      'alice@test.dev',
      'Verify your Compta email',
      expect.stringContaining('Hi alice,'),
    );
  });

  it('rethrows transient errors so the queue retries', async () => {
    const failure = new EmailSendError('rate_limit_exceeded: slow down', true);

    await expect(
      processEmailJob(
        providerThat(() => Promise.reject(failure)),
        job,
      ),
    ).rejects.toBe(failure);
  });

  it('rethrows unknown errors (network, timeout) so the queue retries', async () => {
    const failure = new Error('ECONNRESET');

    await expect(
      processEmailJob(
        providerThat(() => Promise.reject(failure)),
        job,
      ),
    ).rejects.toBe(failure);
  });

  it('turns a permanent error into UnrecoverableError so retries are skipped', async () => {
    const failure = new EmailSendError('validation_error: Invalid `to` field', false);

    await expect(
      processEmailJob(
        providerThat(() => Promise.reject(failure)),
        job,
      ),
    ).rejects.toBeInstanceOf(UnrecoverableError);
  });
});
