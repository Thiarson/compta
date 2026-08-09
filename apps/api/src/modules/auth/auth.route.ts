import { buildAuthService } from './auth.service.js';
import { buildAuthRepository } from './auth.repository.js';
import { buildAuthController } from './auth.controller.js';
import { buildAccountsRepository } from '../account/account.repository.js';
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

import type {
  EmptyRoute,
  ForgotPasswordRoute,
  LoginRoute,
  MeRoute,
  RefreshRoute,
  RegisterRoute,
  ResetPasswordRoute,
  VerifyEmailRoute,
  VerifyPasswordResetRoute,
} from './auth.controller.js';
import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';

const authRoute: FastifyPluginAsyncTypebox = async (app) => {
  const authRepository = buildAuthRepository(app.db);
  const accountsRepository = buildAccountsRepository(app.db);
  const authService = buildAuthService(app.db, authRepository, accountsRepository, app.email, {
    appUrl: app.config.APP_URL,
  });
  const authController = buildAuthController(authService);

  app.post<RegisterRoute>(
    '/register',
    { schema: { body: registerBodySchema, response: authResponseSchema } },
    authController.register,
  );

  app.post<LoginRoute>(
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

  app.post<VerifyEmailRoute>(
    '/verify-email',
    { schema: { body: verifyEmailBodySchema } },
    authController.verifyEmail,
  );

  app.post<ForgotPasswordRoute>(
    '/forgot-password',
    {
      schema: { body: forgotPasswordBodySchema },
      config: { rateLimit: { max: 3, timeWindow: '10 minutes' } },
    },
    authController.forgotPassword,
  );

  app.post<VerifyPasswordResetRoute>(
    '/verify-password-reset',
    { schema: { body: verifyPasswordResetBodySchema } },
    authController.verifyPasswordReset,
  );

  app.post<ResetPasswordRoute>(
    '/reset-password',
    { schema: { body: resetPasswordBodySchema } },
    authController.resetPassword,
  );

  app.post<RefreshRoute>(
    '/refresh',
    { schema: { response: authResponseSchema } },
    authController.refresh,
  );

  app.get<MeRoute>(
    '/me',
    { schema: { response: meResponseSchema }, preHandler: [app.authenticate] },
    authController.me,
  );

  app.post<EmptyRoute>('/logout', authController.logout);
};

export default authRoute;
