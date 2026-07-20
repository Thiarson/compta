import { daysToMs } from '../../utils/time.js';
import { generateToken, hashToken } from '../../utils/token.js';
import { hashPassword, verifyPassword } from '../../utils/password.js';
import { ConflictError, UnauthorizedError } from '../../utils/http-error.js';
import { EMAIL_VERIFICATION_TTL_MS } from '../../constants/token.js';

import type { EmailProvider } from '../../plugins/email.js';
import type { buildAuthRepository } from './auth.repository.js';
import type { LoginBody, RegisterBody } from '@compta/contracts';

type AuthRepository = ReturnType<typeof buildAuthRepository>;

interface AuthServiceConfig {
  appUrl: string;
}

export function buildAuthService(
  authRepository: AuthRepository,
  emailProvider: EmailProvider,
  config: AuthServiceConfig,
) {
  async function sendVerificationEmail(userId: string, email: string, username: string) {
    const token = generateToken();
    const expiresAt = new Date(Date.now() + EMAIL_VERIFICATION_TTL_MS);
    const verificationUrl = `${config.appUrl}/verify-email?token=${token}`;

    await authRepository.createEmailVerificationToken({
      userId: userId,
      tokenHash: hashToken(token),
      expiresAt,
    });

    await emailProvider.sendEmail(
      email,
      'Verify your Compta email',
      `
        <p>Hi ${username},</p>
        <p>Click the link below to verify your email address. This link expires in 8 hours.</p>
        <p><a href="${verificationUrl}">Verify my email</a></p>
        <p>Or copy this URL into your browser:<br>${verificationUrl}</p>
        <p>If you didn't create an account, you can ignore this email.</p>
      `,
    );
  }

  return {
    async register({ username, email, password }: RegisterBody) {
      const existing = await authRepository.findUserByEmail(email);
      if (existing) {
        throw new ConflictError('Email already in use');
      }

      const passwordHash = await hashPassword(password);
      const newUser = await authRepository.createUser({ username, email, passwordHash });

      await sendVerificationEmail(newUser.id, email, username);

      return newUser;
    },

    async validateCredentials({ email, password }: LoginBody) {
      const user = await authRepository.findUserByEmail(email);
      if (!user || !user.isActive) {
        throw new UnauthorizedError('Invalid email or password');
      }

      const isValid = await verifyPassword(password, user.passwordHash);
      if (!isValid) {
        throw new UnauthorizedError('Invalid email or password');
      }

      return user;
    },

    async storeRefreshToken(userId: string, refreshToken: string, tokenTtlDays: number) {
      const expiresAt = new Date(Date.now() + daysToMs(tokenTtlDays));
      await authRepository.createRefreshToken({
        userId,
        tokenHash: hashToken(refreshToken),
        expiresAt,
      });
    },

    async rotateRefreshToken(refreshToken: string) {
      const tokenHash = hashToken(refreshToken);
      const record = await authRepository.findRefreshTokenByHash(tokenHash);

      if (!record || record.revokedAt || record.expiresAt < new Date()) {
        throw new UnauthorizedError('Invalid refresh token');
      }

      await authRepository.revokeRefreshToken(tokenHash);

      const user = await authRepository.findUserById(record.userId);
      if (!user || !user.isActive) {
        throw new UnauthorizedError('Invalid refresh token');
      }

      return user;
    },

    async revokeRefreshToken(refreshToken: string) {
      const tokenHash = hashToken(refreshToken);
      await authRepository.revokeRefreshToken(tokenHash);
    },
  };
}
