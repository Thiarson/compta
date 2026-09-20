import { buildAuthService } from './auth.service.js';
import { buildAuthRepository } from './auth.repository.js';
import { buildAuthController } from './auth.controller.js';
import { buildAccountsRepository } from '../accounts/accounts.repository.js';
import {
  authResponseSchema,
  forgotPasswordBodySchema,
  forgotPasswordResponseSchema,
  loginBodySchema,
  logoutResponseSchema,
  meResponseSchema,
  registerBodySchema,
  resendVerificationResponseSchema,
  resetPasswordBodySchema,
  resetPasswordResponseSchema,
  verifyEmailBodySchema,
  verifyEmailResponseSchema,
  verifyPasswordResetBodySchema,
  verifyPasswordResetResponseSchema,
} from '@compta/contracts';

import type {
  ForgotPasswordRoute,
  LoginRoute,
  LogoutRoute,
  MeRoute,
  RefreshRoute,
  RegisterRoute,
  ResendVerificationRoute,
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
    {
      schema: { body: registerBodySchema, response: authResponseSchema },
      config: { rateLimit: { max: 5, timeWindow: '10 minutes' } },
    },
    authController.register,
  );

  app.post<LoginRoute>(
    '/login',
    {
      schema: { body: loginBodySchema, response: authResponseSchema },
      config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
    },
    authController.login,
  );

  app.post<ResendVerificationRoute>(
    '/resend-verification',
    {
      schema: { response: resendVerificationResponseSchema },
      preHandler: [app.authenticate],
      config: { rateLimit: { max: 3, timeWindow: '10 minutes' } },
    },
    authController.resendVerification,
  );

  app.post<VerifyEmailRoute>(
    '/verify-email',
    { schema: { body: verifyEmailBodySchema, response: verifyEmailResponseSchema } },
    authController.verifyEmail,
  );

  app.post<ForgotPasswordRoute>(
    '/forgot-password',
    {
      schema: { body: forgotPasswordBodySchema, response: forgotPasswordResponseSchema },
      config: { rateLimit: { max: 3, timeWindow: '10 minutes' } },
    },
    authController.forgotPassword,
  );

  app.post<VerifyPasswordResetRoute>(
    '/verify-password-reset',
    {
      schema: {
        body: verifyPasswordResetBodySchema,
        response: verifyPasswordResetResponseSchema,
      },
    },
    authController.verifyPasswordReset,
  );

  app.post<ResetPasswordRoute>(
    '/reset-password',
    {
      schema: { body: resetPasswordBodySchema, response: resetPasswordResponseSchema },
      config: { rateLimit: { max: 5, timeWindow: '10 minutes' } },
    },
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

  app.post<LogoutRoute>(
    '/logout',
    { schema: { response: logoutResponseSchema } },
    authController.logout,
  );
};

export default authRoute;
