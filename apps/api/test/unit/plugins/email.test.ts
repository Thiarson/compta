import fastify from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import emailPlugin, { SEND_TIMEOUT_MS } from '../../../src/plugins/email.js';

import type { FastifyInstance } from 'fastify';

const send = vi.hoisted(() => vi.fn());

vi.mock('resend', () => ({
  Resend: class {
    emails = { send };
  },
}));

describe('email plugin', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    vi.resetAllMocks();
    app = fastify({ logger: false });
    app.decorate('config', { EMAIL_API_KEY: 're_test', EMAIL_FROM: 'noreply@compta.dev' } as never);
    await app.register(emailPlugin);
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it('sends the email from the configured address', async () => {
    send.mockResolvedValue({ data: { id: 'email-1' }, error: null });

    await app.email.sendEmail('alice@test.dev', 'Hello', '<p>Hi</p>', 'key-1');

    expect(send).toHaveBeenCalledExactlyOnceWith(
      {
        from: 'noreply@compta.dev',
        to: 'alice@test.dev',
        subject: 'Hello',
        html: '<p>Hi</p>',
      },
      { idempotencyKey: 'key-1' }, // lets Resend drop a repeated send of the same job
    );
  });

  it.each([429, 409, 500, 503, null])(
    'throws a retryable error when the provider answers %s',
    async (statusCode) => {
      send.mockResolvedValue({
        data: null,
        error: { name: 'application_error', message: 'x', statusCode },
      });

      await expect(
        app.email.sendEmail('a@test.dev', 'Hello', '<p>Hi</p>', 'key-1'),
      ).rejects.toMatchObject({
        name: 'EmailSendError',
        retryable: true,
      });
    },
  );

  it.each([400, 401, 403, 422])(
    'throws a permanent error when the provider answers %s',
    async (statusCode) => {
      send.mockResolvedValue({
        data: null,
        error: { name: 'validation_error', message: 'Invalid `to` field', statusCode },
      });

      await expect(app.email.sendEmail('bad', 'Hello', '<p>Hi</p>', 'key-1')).rejects.toMatchObject(
        {
          message: 'validation_error: Invalid `to` field',
          retryable: false,
        },
      );
    },
  );

  it('rejects with the original error when the provider cannot be reached', async () => {
    const failure = new Error('ECONNRESET');
    send.mockRejectedValue(failure);

    await expect(app.email.sendEmail('a@test.dev', 'Hello', '<p>Hi</p>', 'key-1')).rejects.toBe(
      failure,
    );
  });

  it('rejects when the provider does not answer in time', async () => {
    vi.useFakeTimers();
    send.mockReturnValue(new Promise(() => {}));

    const sending = app.email.sendEmail('a@test.dev', 'Hello', '<p>Hi</p>', 'key-1');
    const assertion = expect(sending).rejects.toThrow('timed out');
    await vi.advanceTimersByTimeAsync(SEND_TIMEOUT_MS);

    await assertion;
    vi.useRealTimers();
  });
});
