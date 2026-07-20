import { daysToMs } from '../../utils/time.js';
import { generateToken, hashToken } from '../../utils/token.js';
import { hashPassword, verifyPassword } from '../../utils/password.js';
import { ConflictError, NotFoundError, UnauthorizedError } from '../../utils/http-error.js';
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
  function generateVerificationToken() {
    const token = generateToken();
    const expiresAt = new Date(Date.now() + EMAIL_VERIFICATION_TTL_MS);
    const verificationUrl = `${config.appUrl}/verify-email?token=${token}`;

    return { token, expiresAt, verificationUrl };
  }

  async function sendVerificationEmail(email: string, username: string, verificationUrl: string) {
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

      const { token, expiresAt, verificationUrl } = generateVerificationToken();

      await authRepository.createEmailVerificationToken({
        userId: newUser.id,
        tokenHash: hashToken(token),
        expiresAt,
      });

      await sendVerificationEmail(email, username, verificationUrl);

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

    async resendVerification(userId: string) {
      const user = await authRepository.findUserById(userId);
      if (!user || !user.isActive) {
        throw new NotFoundError('Account does not exist');
      }

      if (user.emailVerifiedAt != null) {
        throw new ConflictError('Email already verified');
      }

      const { token, expiresAt, verificationUrl } = generateVerificationToken();

      await authRepository.createEmailVerificationToken({
        userId: user.id,
        tokenHash: hashToken(token),
        expiresAt,
      });

      await sendVerificationEmail(user.email, user.username, verificationUrl);
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
