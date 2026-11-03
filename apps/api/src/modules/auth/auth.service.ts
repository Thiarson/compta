import { daysToMs } from '../../utils/time.js';
import { normalizeEmail } from '../../utils/email.js';
import { isUniqueViolation } from '../../utils/db-error.js';
import { generateToken, hashToken } from '../../utils/token.js';
import { hashPassword, verifyPassword } from '../../utils/password.js';
import {
  BadRequestError,
  ConflictError,
  NotFoundError,
  UnauthorizedError,
} from '../../utils/http-error.js';
import { EMAIL_VERIFICATION_TTL_MS, PASSWORD_RESET_TTL_MS } from '../../constants/token.js';

import type { EmailJob } from '../../constants/queue.js';
import type { Database, DbTransaction } from '@compta/db';
import type { buildAuthRepository } from './auth.repository.js';
import type { LoginBody, RegisterBody } from '@compta/contracts';
import type { buildAccountsRepository } from '../accounts/accounts.repository.js';
import type { buildEventsRepository } from '../notifications/events.repository.js';
import type { buildNotificationsRepository } from '../notifications/notifications.repository.js';

type AuthRepository = ReturnType<typeof buildAuthRepository>;
type EventsRepository = ReturnType<typeof buildEventsRepository>;
type AccountsRepository = ReturnType<typeof buildAccountsRepository>;
type NotificationsRepository = ReturnType<typeof buildNotificationsRepository>;

type EmailRecipient = { id: string; email: string; username: string };

interface AuthServiceConfig {
  appUrl: string;
}

export function buildAuthService(
  db: Database['db'],
  authRepository: AuthRepository,
  accountsRepository: AccountsRepository,
  notificationsRepository: NotificationsRepository,
  eventsRepository: EventsRepository,
  config: AuthServiceConfig,
) {
  function generateVerificationToken() {
    const token = generateToken();
    const expiresAt = new Date(Date.now() + EMAIL_VERIFICATION_TTL_MS);
    const verificationUrl = `${config.appUrl}/verify-email?token=${token}`;

    return { token, expiresAt, verificationUrl };
  }

  function generatePasswordResetToken() {
    const token = generateToken();
    const expiresAt = new Date(Date.now() + PASSWORD_RESET_TTL_MS);
    const passwordResetUrl = `${config.appUrl}/reset-password?token=${token}`;

    return { token, expiresAt, passwordResetUrl };
  }

  async function queueEmail(user: EmailRecipient, job: EmailJob, tx: DbTransaction) {
    const notification = await notificationsRepository.create(
      { userId: user.id, type: job.template },
      tx,
    );
    await eventsRepository.create({ eventId: notification.id, payload: job }, tx);
  }

  async function queueVerificationEmail(user: EmailRecipient, tx: DbTransaction) {
    const { token, expiresAt, verificationUrl } = generateVerificationToken();

    await authRepository.createEmailVerificationToken(
      { userId: user.id, tokenHash: hashToken(token), expiresAt },
      tx,
    );
    await queueEmail(
      user,
      {
        to: user.email,
        template: 'verify-email',
        params: { username: user.username, url: verificationUrl },
      },
      tx,
    );
  }

  async function queuePasswordResetEmail(user: EmailRecipient, tx: DbTransaction) {
    const { token, expiresAt, passwordResetUrl } = generatePasswordResetToken();

    await authRepository.createPasswordResetToken(
      { userId: user.id, tokenHash: hashToken(token), expiresAt },
      tx,
    );
    await queueEmail(
      user,
      {
        to: user.email,
        template: 'reset-password',
        params: { username: user.username, url: passwordResetUrl },
      },
      tx,
    );
  }

  return {
    async register({ username, email: rawEmail, password }: RegisterBody) {
      const email = normalizeEmail(rawEmail);
      const existing = await authRepository.findUserByEmail(email);
      if (existing) {
        throw new ConflictError('Email already in use');
      }

      const passwordHash = await hashPassword(password);
      let newUser;
      try {
        newUser = await db.transaction(async (tx) => {
          const user = await authRepository.createUser({ username, email, passwordHash }, tx);
          await accountsRepository.createDefault(user.id, tx);
          await queueVerificationEmail(user, tx);
          return user;
        });
      } catch (err) {
        // Another request registered the same email between the check above and the insert
        if (isUniqueViolation(err)) throw new ConflictError('Email already in use');
        throw err;
      }

      return newUser;
    },

    async validateCredentials({ email, password }: LoginBody) {
      const user = await authRepository.findUserByEmail(normalizeEmail(email));
      if (!user || !user.isActive) {
        throw new UnauthorizedError('Invalid email or password');
      }

      const isValid = await verifyPassword(password, user.passwordHash);
      if (!isValid) {
        throw new UnauthorizedError('Invalid email or password');
      }

      return user;
    },

    async getCurrentUser(userId: string) {
      const user = await authRepository.findUserById(userId);
      if (!user || !user.isActive) {
        throw new UnauthorizedError('Invalid session');
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

      await db.transaction((tx) => queueVerificationEmail(user, tx));
    },

    async verifyEmailToken(verificationToken: string) {
      const tokenHash = hashToken(verificationToken);
      const existingToken = await authRepository.findVerificationTokenByHash(tokenHash);
      if (
        !existingToken ||
        existingToken.usedAt != null ||
        existingToken.invalidatedAt != null ||
        existingToken.expiresAt < new Date()
      ) {
        throw new BadRequestError('Invalid or expired verification token');
      }

      const verified = await authRepository.markEmailAsVerified(
        existingToken.userId,
        existingToken.id,
      );
      if (!verified) {
        throw new BadRequestError('Invalid or expired verification token');
      }
    },

    async forgotPassword(email: string) {
      const user = await authRepository.findUserByEmail(normalizeEmail(email));
      // Always resolve the same way whether or not the account exists,
      // so this endpoint can't be used to enumerate registered emails.
      if (!user || !user.isActive) {
        return;
      }

      await db.transaction((tx) => queuePasswordResetEmail(user, tx));
    },

    async verifyPasswordResetToken(passwordResetToken: string) {
      const tokenHash = hashToken(passwordResetToken);
      const existingToken = await authRepository.findPasswordResetTokenByHash(tokenHash);
      if (
        !existingToken ||
        existingToken.usedAt != null ||
        existingToken.invalidatedAt != null ||
        existingToken.expiresAt < new Date()
      ) {
        throw new BadRequestError('Invalid or expired password reset token');
      }
    },

    async resetPassword(passwordResetToken: string, newPassword: string) {
      const tokenHash = hashToken(passwordResetToken);
      const existingToken = await authRepository.findPasswordResetTokenByHash(tokenHash);
      if (
        !existingToken ||
        existingToken.usedAt != null ||
        existingToken.invalidatedAt != null ||
        existingToken.expiresAt < new Date()
      ) {
        throw new BadRequestError('Invalid or expired password reset token');
      }

      const newPasswordHash = await hashPassword(newPassword);
      const updated = await authRepository.updatePassword(
        existingToken.userId,
        existingToken.id,
        newPasswordHash,
      );
      if (!updated) {
        throw new BadRequestError('Invalid or expired password reset token');
      }
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

      // Only one of several concurrent requests can revoke the token; the others are rejected
      const revoked = await authRepository.revokeRefreshToken(tokenHash);
      if (!revoked) {
        throw new UnauthorizedError('Invalid refresh token');
      }

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
