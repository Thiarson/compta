import fp from 'fastify-plugin';
import { Resend } from 'resend';
import { EmailSendError } from '../utils/email-error.js';

// Bounds how long a request can wait on the provider.
export const SEND_TIMEOUT_MS = 10_000;

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: NodeJS.Timeout;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`timed out after ${ms}ms`)), ms);
  });

  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

// Rate limits (429), locked resources (409) and provider outages (5xx) can clear on their own.
// Other 4xx (bad recipient, invalid API key, ...) will fail the same way every time.
function isRetryableStatus(statusCode: number | null) {
  return statusCode === null || statusCode === 409 || statusCode === 429 || statusCode >= 500;
}

/**
 * Throws on failure so the queue can retry.
 * Callers that must not fail (HTTP requests) enqueue instead of calling this directly.
 */
function buildEmailProvider(resend: Resend, from: string) {
  return {
    async sendEmail(to: string, subject: string, body: string, idempotencyKey: string) {
      // Resend reports API errors in `error` instead of throwing
      const { error } = await withTimeout(
        resend.emails.send({ from, to, subject, html: body }, { idempotencyKey }),
        SEND_TIMEOUT_MS,
      );
      if (error) {
        throw new EmailSendError(
          `${error.name}: ${error.message}`,
          isRetryableStatus(error.statusCode),
        );
      }
    },
  };
}

export type EmailProvider = ReturnType<typeof buildEmailProvider>;

declare module 'fastify' {
  interface FastifyInstance {
    email: EmailProvider;
  }
}

export default fp(async function emailPlugin(app) {
  const resend = new Resend(app.config.EMAIL_API_KEY);
  app.decorate('email', buildEmailProvider(resend, app.config.EMAIL_FROM));
});
