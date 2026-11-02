import fp from 'fastify-plugin';
import { Resend } from 'resend';

import type { FastifyBaseLogger } from 'fastify';

// Bounds how long a request can wait on the provider.
export const SEND_TIMEOUT_MS = 10_000;

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: NodeJS.Timeout;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`timed out after ${ms}ms`)), ms);
  });

  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

/**
 * Delivery is best-effort: failures are logged and never thrown,
 * so a provider outage can't fail a request (or reveal through a 500 that an email address is registered).
 */
function buildEmailProvider(resend: Resend, from: string, log: FastifyBaseLogger) {
  return {
    async sendEmail(to: string, subject: string, body: string) {
      try {
        // Resend reports API errors in `error` instead of throwing
        const { error } = await withTimeout(
          resend.emails.send({ from, to, subject, html: body }),
          SEND_TIMEOUT_MS,
        );
        if (error) {
          log.error({ err: error, subject }, 'email: delivery failed');
        }
      } catch (err) {
        log.error({ err, subject }, 'email: delivery failed');
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
  app.decorate('email', buildEmailProvider(resend, app.config.EMAIL_FROM, app.log));
});
