import fp from 'fastify-plugin';
import { Resend } from 'resend';

function buildEmailProvider(resend: Resend, from: string) {
  return {
    async sendEmail(to: string, subject: string, body: string) {
      await resend.emails.send({
        from,
        to,
        subject: subject,
        html: body,
      });
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
