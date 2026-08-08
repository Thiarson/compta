import { buildAuthService } from './auth.service.js';
import { buildAuthRepository } from './auth.repository.js';
import { buildAuthController } from './auth.controller.js';
import type { EmptyRoute, MeRoute } from './auth.controller.js';
import {
  authResponseSchema,
  forgotPasswordBodySchema,
  loginBodySchema,
  meResponseSchema,
  registerBodySchema,
  resetPasswordBodySchema,
  verifyEmailBodySchema,
  verifyPasswordResetBodySchema,
} from '@compta/contracts';

import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';

const authRoute: FastifyPluginAsyncTypebox = async (app) => {
  const authRepository = buildAuthRepository(app.db);
  const authService = buildAuthService(authRepository, app.email, { appUrl: app.config.APP_URL });
  const authController = buildAuthController(authService);

  app.post(
    '/register',
    { schema: { body: registerBodySchema, response: authResponseSchema } },
    authController.register,
  );

  app.post(
    '/login',
    { schema: { body: loginBodySchema, response: authResponseSchema } },
    authController.login,
  );

  app.post<EmptyRoute>(
    '/resend-verification',
    {
      preHandler: [app.authenticate],
      config: { rateLimit: { max: 3, timeWindow: '10 minutes' } },
    },
    authController.resendVerification,
  );

  app.post(
    '/verify-email',
    { schema: { body: verifyEmailBodySchema } },
    authController.verifyEmail,
  );

  app.post(
    '/forgot-password',
    { schema: { body: forgotPasswordBodySchema } },
    authController.forgotPassword,
  );

  app.post(
    '/verify-password-reset',
    { schema: { body: verifyPasswordResetBodySchema } },
    authController.verifyPasswordReset,
  );

  app.post(
    '/reset-password',
    { schema: { body: resetPasswordBodySchema } },
    authController.resetPassword,
  );

  app.post('/refresh', { schema: { response: authResponseSchema } }, authController.refresh);

  app.get<MeRoute>(
    '/me',
    { schema: { response: meResponseSchema }, preHandler: [app.authenticate] },
    authController.me,
  );

  app.post('/logout', authController.logout);
};

export default authRoute;
