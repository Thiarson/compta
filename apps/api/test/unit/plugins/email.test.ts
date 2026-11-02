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

    await app.email.sendEmail('alice@test.dev', 'Hello', '<p>Hi</p>');

    expect(send).toHaveBeenCalledExactlyOnceWith({
      from: 'noreply@compta.dev',
      to: 'alice@test.dev',
      subject: 'Hello',
      html: '<p>Hi</p>',
    });
  });

  it('logs and resolves when the provider reports an error', async () => {
    const logError = vi.spyOn(app.log, 'error');
    const error = { name: 'validation_error', message: 'Invalid `to` field', statusCode: 422 };
    send.mockResolvedValue({ data: null, error });

    await expect(app.email.sendEmail('bad', 'Hello', '<p>Hi</p>')).resolves.toBeUndefined();
    expect(logError).toHaveBeenCalledWith(
      { err: error, subject: 'Hello' },
      'email: delivery failed',
    );
  });

  it('logs and resolves when the provider cannot be reached', async () => {
    const logError = vi.spyOn(app.log, 'error');
    const failure = new Error('ECONNRESET');
    send.mockRejectedValue(failure);

    await expect(
      app.email.sendEmail('alice@test.dev', 'Hello', '<p>Hi</p>'),
    ).resolves.toBeUndefined();
    expect(logError).toHaveBeenCalledWith(
      { err: failure, subject: 'Hello' },
      'email: delivery failed',
    );
  });

  it('gives up and resolves when the provider does not answer in time', async () => {
    vi.useFakeTimers();
    const logError = vi.spyOn(app.log, 'error');
    send.mockReturnValue(new Promise(() => {}));

    const sending = app.email.sendEmail('alice@test.dev', 'Hello', '<p>Hi</p>');
    await vi.advanceTimersByTimeAsync(SEND_TIMEOUT_MS);

    await expect(sending).resolves.toBeUndefined();
    expect(logError).toHaveBeenCalledWith(
      {
        err: expect.objectContaining({ message: expect.stringContaining('timed out') }),
        subject: 'Hello',
      },
      'email: delivery failed',
    );
    vi.useRealTimers();
  });

  it('never logs the recipient address', async () => {
    const logError = vi.spyOn(app.log, 'error');
    send.mockRejectedValue(new Error('ECONNRESET'));

    await app.email.sendEmail('alice@test.dev', 'Hello', '<p>Hi</p>');

    expect(JSON.stringify(logError.mock.calls)).not.toContain('alice@test.dev');
  });
});
