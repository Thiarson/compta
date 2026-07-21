import { UnauthorizedError } from '../../utils/http-error.js';
import { REFRESH_COOKIE_NAME, REFRESH_COOKIE_PATH } from '../../constants/token.js';

import type { FastifyRequest, FastifyReply } from 'fastify';
import type { buildAuthService } from './auth.service.js';
import type {
  LoginBody,
  RegisterBody,
  AuthResponse,
  VerifyEmailBody,
  ForgotPasswordBody,
} from '@compta/contracts';

type AuthService = ReturnType<typeof buildAuthService>;

interface LoginRoute {
  Body: LoginBody;
  Reply: AuthResponse;
}

interface RegisterRoute {
  Body: RegisterBody;
  Reply: AuthResponse;
}

interface VerifyEmailRoute {
  Body: VerifyEmailBody;
}

interface ForgotPasswordRoute {
  Body: ForgotPasswordBody;
}

interface RefreshRoute {
  Reply: AuthResponse;
}

interface EmptyRoute {
  Reply: void;
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

      return {
        accessToken,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
        },
      };
    },

    async login(request: FastifyRequest<LoginRoute>, reply: FastifyReply<LoginRoute>) {
      const user = await authService.validateCredentials(request.body);
      const { accessToken, refreshToken } = await signPairTokens(reply, user.id);

      const tokenTtlDays = getRefreshTokenTtlDays(reply);
      await authService.storeRefreshToken(user.id, refreshToken, tokenTtlDays);

      setRefreshTokenCookie(reply, refreshToken, tokenTtlDays);

      reply.send({
        accessToken,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
        },
      });
    },

    async resendVerification(request: FastifyRequest<EmptyRoute>, reply: FastifyReply<EmptyRoute>) {
      const { sub: userId } = await request.verifyAccessToken();
      await authService.resendVerification(userId);

      reply.status(202).send();
    },

    async verifyEmail(
      request: FastifyRequest<VerifyEmailRoute>,
      reply: FastifyReply<VerifyEmailRoute>,
    ) {
      await authService.verifyEmailToken(request.body.verificationToken);

      reply.status(204).send();
    },

    async forgotPassword(
      request: FastifyRequest<ForgotPasswordRoute>,
      reply: FastifyReply<ForgotPasswordRoute>,
    ) {
      await authService.resetPassword(request.body.email);

      reply.status(204).send();
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

      reply.send({
        accessToken,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
        },
      });
    },

    async logout(request: FastifyRequest<EmptyRoute>, reply: FastifyReply<EmptyRoute>) {
      const refreshToken = request.cookies[REFRESH_COOKIE_NAME];
      if (refreshToken) {
        await authService.revokeRefreshToken(refreshToken);
      }

      reply.clearCookie(REFRESH_COOKIE_NAME, { path: REFRESH_COOKIE_PATH });
      reply.status(204).send();
    },
  };
}
