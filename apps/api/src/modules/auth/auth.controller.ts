import { UnauthorizedError } from '../../utils/http-error.js';
import { REFRESH_COOKIE_NAME, REFRESH_COOKIE_PATH } from '../../constants/token.js';

import type { FastifyRequest, FastifyReply } from 'fastify';
import type { buildAuthService } from './auth.service.js';
import type {
  LoginBody,
  RegisterBody,
  AuthResponse,
  MeResponse,
  VerifyEmailBody,
  ForgotPasswordBody,
  VerifyPasswordResetBody,
  ResetPasswordBody,
  VerifyEmailResponse,
  ForgotPasswordResponse,
  ResetPasswordResponse,
  VerifyPasswordResetResponse,
  ResendVerificationResponse,
  LogoutResponse,
} from '@compta/contracts';

type AuthService = ReturnType<typeof buildAuthService>;

export interface LoginRoute {
  Body: LoginBody;
  Reply: AuthResponse;
}

export interface RegisterRoute {
  Body: RegisterBody;
  Reply: AuthResponse;
}

export interface VerifyEmailRoute {
  Body: VerifyEmailBody;
  Reply: VerifyEmailResponse;
}

export interface ForgotPasswordRoute {
  Body: ForgotPasswordBody;
  Reply: ForgotPasswordResponse;
}

export interface VerifyPasswordResetRoute {
  Body: VerifyPasswordResetBody;
  Reply: VerifyPasswordResetResponse;
}

export interface ResetPasswordRoute {
  Body: ResetPasswordBody;
  Reply: ResetPasswordResponse;
}

export interface RefreshRoute {
  Reply: AuthResponse;
}

export interface MeRoute {
  Reply: MeResponse;
}

export interface ResendVerificationRoute {
  Reply: ResendVerificationResponse;
}

export interface LogoutRoute {
  Reply: LogoutResponse;
}

async function signPairTokens(reply: FastifyReply, userId: string) {
  const accessToken = await reply.signAccessToken({ sub: userId });
  const refreshToken = await reply.signRefreshToken({ sub: userId });

  return { accessToken, refreshToken };
}

function getRefreshTokenTtlDays(reply: FastifyReply): number {
  return Number(reply.server.config.REFRESH_TOKEN_TTL_DAYS);
}

function setRefreshTokenCookie(reply: FastifyReply, refreshToken: string, tokenTtlDays: number) {
  reply.setCookie(REFRESH_COOKIE_NAME, refreshToken, {
    httpOnly: true,
    secure: reply.server.config.NODE_ENV === 'production',
    sameSite: 'strict',
    path: REFRESH_COOKIE_PATH,
    maxAge: tokenTtlDays * 24 * 60 * 60,
  });
}

export function buildAuthController(authService: AuthService) {
  return {
    async register(request: FastifyRequest<RegisterRoute>, reply: FastifyReply<RegisterRoute>) {
      const user = await authService.register(request.body);
      const { accessToken, refreshToken } = await signPairTokens(reply, user.id);

      const tokenTtlDays = getRefreshTokenTtlDays(reply);
      await authService.storeRefreshToken(user.id, refreshToken, tokenTtlDays);

      setRefreshTokenCookie(reply, refreshToken, tokenTtlDays);

      return reply.code(201).send({
        accessToken,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          emailVerifiedAt: user.emailVerifiedAt?.toISOString() ?? null,
        },
      });
    },

    async login(request: FastifyRequest<LoginRoute>, reply: FastifyReply<LoginRoute>) {
      const user = await authService.validateCredentials(request.body);
      const { accessToken, refreshToken } = await signPairTokens(reply, user.id);

      const tokenTtlDays = getRefreshTokenTtlDays(reply);
      await authService.storeRefreshToken(user.id, refreshToken, tokenTtlDays);

      setRefreshTokenCookie(reply, refreshToken, tokenTtlDays);

      return reply.send({
        accessToken,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          emailVerifiedAt: user.emailVerifiedAt?.toISOString() ?? null,
        },
      });
    },

    async resendVerification(
      request: FastifyRequest<ResendVerificationRoute>,
      reply: FastifyReply<ResendVerificationRoute>,
    ) {
      const { sub: userId } = request.accessTokenPayload!;
      await authService.resendVerification(userId);

      return reply.status(202).send();
    },

    async verifyEmail(
      request: FastifyRequest<VerifyEmailRoute>,
      reply: FastifyReply<VerifyEmailRoute>,
    ) {
      await authService.verifyEmailToken(request.body.verificationToken);

      return reply.status(204).send();
    },

    async forgotPassword(
      request: FastifyRequest<ForgotPasswordRoute>,
      reply: FastifyReply<ForgotPasswordRoute>,
    ) {
      await authService.forgotPassword(request.body.email);

      return reply.status(204).send();
    },

    async verifyPasswordReset(
      request: FastifyRequest<VerifyPasswordResetRoute>,
      reply: FastifyReply<VerifyPasswordResetRoute>,
    ) {
      await authService.verifyPasswordResetToken(request.body.passwordResetToken);

      return reply.status(204).send();
    },

    async resetPassword(
      request: FastifyRequest<ResetPasswordRoute>,
      reply: FastifyReply<ResetPasswordRoute>,
    ) {
      await authService.resetPassword(request.body.passwordResetToken, request.body.newPassword);

      return reply.status(204).send();
    },

    async refresh(request: FastifyRequest<RefreshRoute>, reply: FastifyReply<RefreshRoute>) {
      const oldRefreshToken = request.cookies[REFRESH_COOKIE_NAME];
      if (!oldRefreshToken) {
        throw new UnauthorizedError('Missing refresh token');
      }

      try {
        await request.verifyRefreshToken({ onlyCookie: true });
      } catch {
        throw new UnauthorizedError('Invalid refresh token');
      }

      const user = await authService.rotateRefreshToken(oldRefreshToken);
      const { accessToken, refreshToken } = await signPairTokens(reply, user.id);

      const tokenTtlDays = getRefreshTokenTtlDays(reply);
      await authService.storeRefreshToken(user.id, refreshToken, tokenTtlDays);

      setRefreshTokenCookie(reply, refreshToken, tokenTtlDays);

      return reply.send({
        accessToken,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          emailVerifiedAt: user.emailVerifiedAt?.toISOString() ?? null,
        },
      });
    },

    async me(request: FastifyRequest<MeRoute>, reply: FastifyReply<MeRoute>) {
      const { sub: userId } = request.accessTokenPayload!;
      const user = await authService.getCurrentUser(userId);

      return reply.send({
        id: user.id,
        username: user.username,
        email: user.email,
        emailVerifiedAt: user.emailVerifiedAt?.toISOString() ?? null,
      });
    },

    async logout(request: FastifyRequest<LogoutRoute>, reply: FastifyReply<LogoutRoute>) {
      const refreshToken = request.cookies[REFRESH_COOKIE_NAME];
      if (refreshToken) {
        await authService.revokeRefreshToken(refreshToken);
      }

      reply.clearCookie(REFRESH_COOKIE_NAME, { path: REFRESH_COOKIE_PATH });
      return reply.status(204).send();
    },
  };
}
