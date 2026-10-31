import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildAuthService } from '../../../../src/modules/auth/auth.service.js';
import { hashToken } from '../../../../src/utils/token.js';
import { hashPassword, verifyPassword } from '../../../../src/utils/password.js';
import {
  BadRequestError,
  ConflictError,
  UnauthorizedError,
} from '../../../../src/utils/http-error.js';
import {
  anHourAgo,
  buildOneTimeToken,
  buildRefreshToken,
  buildUser,
} from '../../../helpers/fixtures.js';

import type { buildAuthRepository } from '../../../../src/modules/auth/auth.repository.js';
import type { buildAccountsRepository } from '../../../../src/modules/accounts/accounts.repository.js';
import type { EmailProvider } from '../../../../src/plugins/email.js';

// argon2 is deliberately slow (64 MiB); its real behaviour is covered in password.test.ts
vi.mock('../../../../src/utils/password.js');

type Db = Parameters<typeof buildAuthService>[0];
type AuthRepository = ReturnType<typeof buildAuthRepository>;
type AccountsRepository = ReturnType<typeof buildAccountsRepository>;

const APP_URL = 'http://localhost:5173';
const TOKEN = 'a'.repeat(64);

const INVALID_TOKEN_CASES = [
  { name: 'unknown', token: undefined },
  { name: 'already used', token: buildOneTimeToken({ usedAt: new Date() }) },
  { name: 'invalidated', token: buildOneTimeToken({ invalidatedAt: new Date() }) },
  { name: 'expired', token: buildOneTimeToken({ expiresAt: anHourAgo() }) },
];

describe('auth.service', () => {
  const tx = Symbol('transaction');
  const db = { transaction: vi.fn() };
  const authRepository = {
    createUser: vi.fn(),
    findUserByEmail: vi.fn(),
    findUserById: vi.fn(),
    createRefreshToken: vi.fn(),
    findRefreshTokenByHash: vi.fn(),
    revokeRefreshToken: vi.fn(),
    createEmailVerificationToken: vi.fn(),
    createPasswordResetToken: vi.fn(),
    findVerificationTokenByHash: vi.fn(),
    findPasswordResetTokenByHash: vi.fn(),
    markEmailAsVerified: vi.fn(),
    updatePassword: vi.fn(),
  };
  const accountsRepository = { createDefault: vi.fn() };
  const emailProvider = { sendEmail: vi.fn() };

  const service = buildAuthService(
    db as unknown as Db,
    authRepository as unknown as AuthRepository,
    accountsRepository as unknown as AccountsRepository,
    emailProvider as unknown as EmailProvider,
    { appUrl: APP_URL },
  );

  beforeEach(() => {
    vi.resetAllMocks();
    db.transaction.mockImplementation((callback: (tx: unknown) => unknown) => callback(tx));
  });

  describe('register', () => {
    const input = { username: 'alice', email: 'alice@test.dev', password: 'password123' };

    it('throws ConflictError without hashing the password when the email is taken', async () => {
      authRepository.findUserByEmail.mockResolvedValue(buildUser());

      await expect(service.register(input)).rejects.toThrow(
        new ConflictError('Email already in use'),
      );
      expect(hashPassword).not.toHaveBeenCalled();
      expect(authRepository.createUser).not.toHaveBeenCalled();
      expect(emailProvider.sendEmail).not.toHaveBeenCalled();
    });

    it('normalizes the email before looking it up and storing it', async () => {
      authRepository.findUserByEmail.mockResolvedValue(undefined);
      authRepository.createUser.mockResolvedValue(buildUser());

      await service.register({ ...input, email: '  Alice@Test.DEV ' });

      expect(authRepository.findUserByEmail).toHaveBeenCalledWith('alice@test.dev');
      expect(authRepository.createUser).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'alice@test.dev' }),
        tx,
      );
    });

    it('creates the user and default account in one transaction, then sends a verification email', async () => {
      const user = buildUser();
      authRepository.findUserByEmail.mockResolvedValue(undefined);
      vi.mocked(hashPassword).mockResolvedValue('hashed-password');
      authRepository.createUser.mockResolvedValue(user);

      await expect(service.register(input)).resolves.toBe(user);

      expect(authRepository.createUser).toHaveBeenCalledWith(
        { username: 'alice', email: 'alice@test.dev', passwordHash: 'hashed-password' },
        tx,
      );
      expect(accountsRepository.createDefault).toHaveBeenCalledWith(user.id, tx);
      expect(emailProvider.sendEmail).toHaveBeenCalledExactlyOnceWith(
        'alice@test.dev',
        expect.any(String),
        expect.stringContaining(`${APP_URL}/verify-email?token=`),
      );
    });

    it('stores only the hash of the verification token that is emailed', async () => {
      authRepository.findUserByEmail.mockResolvedValue(undefined);
      authRepository.createUser.mockResolvedValue(buildUser());

      await service.register(input);

      const emailBody = emailProvider.sendEmail.mock.calls[0][2] as string;
      const emailedToken = emailBody.match(/token=([a-f0-9]{64})/)![1];
      expect(authRepository.createEmailVerificationToken).toHaveBeenCalledWith(
        expect.objectContaining({ tokenHash: hashToken(emailedToken) }),
      );
    });
  });

  describe('validateCredentials', () => {
    const credentials = { email: 'alice@test.dev', password: 'password123' };
    const invalidCredentials = new UnauthorizedError('Invalid email or password');

    it('returns the user when the password is correct', async () => {
      const user = buildUser();
      authRepository.findUserByEmail.mockResolvedValue(user);
      vi.mocked(verifyPassword).mockResolvedValue(true);

      await expect(service.validateCredentials(credentials)).resolves.toBe(user);
      expect(verifyPassword).toHaveBeenCalledWith('password123', user.passwordHash);
    });

    it('normalizes the email before looking the user up', async () => {
      authRepository.findUserByEmail.mockResolvedValue(buildUser());
      vi.mocked(verifyPassword).mockResolvedValue(true);

      await service.validateCredentials({ ...credentials, email: 'ALICE@Test.dev ' });

      expect(authRepository.findUserByEmail).toHaveBeenCalledWith('alice@test.dev');
    });

    it.each([
      { name: 'the user does not exist', user: undefined, passwordMatches: true },
      { name: 'the user is inactive', user: buildUser({ isActive: false }), passwordMatches: true },
      { name: 'the password is wrong', user: buildUser(), passwordMatches: false },
    ])('throws the same generic error when $name', async ({ user, passwordMatches }) => {
      authRepository.findUserByEmail.mockResolvedValue(user);
      vi.mocked(verifyPassword).mockResolvedValue(passwordMatches);

      await expect(service.validateCredentials(credentials)).rejects.toThrow(invalidCredentials);
    });
  });

  describe('verifyEmailToken', () => {
    it('marks the email as verified for a valid token', async () => {
      const record = buildOneTimeToken();
      authRepository.findVerificationTokenByHash.mockResolvedValue(record);
      authRepository.markEmailAsVerified.mockResolvedValue(true);

      await expect(service.verifyEmailToken(TOKEN)).resolves.toBeUndefined();
      expect(authRepository.findVerificationTokenByHash).toHaveBeenCalledWith(hashToken(TOKEN));
      expect(authRepository.markEmailAsVerified).toHaveBeenCalledWith(record.userId, record.id);
    });

    it.each(INVALID_TOKEN_CASES)('throws BadRequestError for a $name token', async ({ token }) => {
      authRepository.findVerificationTokenByHash.mockResolvedValue(token);

      await expect(service.verifyEmailToken(TOKEN)).rejects.toThrow(
        new BadRequestError('Invalid or expired verification token'),
      );
      expect(authRepository.markEmailAsVerified).not.toHaveBeenCalled();
    });

    it('throws BadRequestError when the token is consumed concurrently', async () => {
      authRepository.findVerificationTokenByHash.mockResolvedValue(buildOneTimeToken());
      authRepository.markEmailAsVerified.mockResolvedValue(false);

      await expect(service.verifyEmailToken(TOKEN)).rejects.toThrow(
        new BadRequestError('Invalid or expired verification token'),
      );
    });
  });

  describe('verifyPasswordResetToken', () => {
    it('resolves for a valid token', async () => {
      authRepository.findPasswordResetTokenByHash.mockResolvedValue(buildOneTimeToken());

      await expect(service.verifyPasswordResetToken(TOKEN)).resolves.toBeUndefined();
      expect(authRepository.findPasswordResetTokenByHash).toHaveBeenCalledWith(hashToken(TOKEN));
    });

    it.each(INVALID_TOKEN_CASES)('throws BadRequestError for a $name token', async ({ token }) => {
      authRepository.findPasswordResetTokenByHash.mockResolvedValue(token);

      await expect(service.verifyPasswordResetToken(TOKEN)).rejects.toThrow(
        new BadRequestError('Invalid or expired password reset token'),
      );
    });
  });

  describe('resetPassword', () => {
    it('updates the password with the new hash for a valid token', async () => {
      const record = buildOneTimeToken();
      authRepository.findPasswordResetTokenByHash.mockResolvedValue(record);
      vi.mocked(hashPassword).mockResolvedValue('new-hash');
      authRepository.updatePassword.mockResolvedValue(true);

      await expect(service.resetPassword(TOKEN, 'new-password')).resolves.toBeUndefined();
      expect(hashPassword).toHaveBeenCalledWith('new-password');
      expect(authRepository.updatePassword).toHaveBeenCalledWith(
        record.userId,
        record.id,
        'new-hash',
      );
    });

    it.each(INVALID_TOKEN_CASES)(
      'throws BadRequestError without hashing for a $name token',
      async ({ token }) => {
        authRepository.findPasswordResetTokenByHash.mockResolvedValue(token);

        await expect(service.resetPassword(TOKEN, 'new-password')).rejects.toThrow(
          new BadRequestError('Invalid or expired password reset token'),
        );
        expect(hashPassword).not.toHaveBeenCalled();
        expect(authRepository.updatePassword).not.toHaveBeenCalled();
      },
    );

    it('throws BadRequestError when the token is consumed concurrently', async () => {
      authRepository.findPasswordResetTokenByHash.mockResolvedValue(buildOneTimeToken());
      authRepository.updatePassword.mockResolvedValue(false);

      await expect(service.resetPassword(TOKEN, 'new-password')).rejects.toThrow(
        new BadRequestError('Invalid or expired password reset token'),
      );
    });
  });

  describe('forgotPassword', () => {
    it.each([
      { name: 'unknown', user: undefined },
      { name: 'inactive', user: buildUser({ isActive: false }) },
    ])('resolves silently and sends nothing for an $name user', async ({ user }) => {
      authRepository.findUserByEmail.mockResolvedValue(user);

      await expect(service.forgotPassword('alice@test.dev')).resolves.toBeUndefined();
      expect(authRepository.createPasswordResetToken).not.toHaveBeenCalled();
      expect(emailProvider.sendEmail).not.toHaveBeenCalled();
    });

    it('stores a hashed token and emails the reset link for an active user', async () => {
      const user = buildUser();
      authRepository.findUserByEmail.mockResolvedValue(user);

      await service.forgotPassword(user.email);

      const emailBody = emailProvider.sendEmail.mock.calls[0][2] as string;
      const emailedToken = emailBody.match(/reset-password\?token=([a-f0-9]{64})/)![1];
      expect(authRepository.createPasswordResetToken).toHaveBeenCalledWith(
        expect.objectContaining({ userId: user.id, tokenHash: hashToken(emailedToken) }),
      );
      expect(emailProvider.sendEmail).toHaveBeenCalledWith(
        user.email,
        expect.any(String),
        expect.stringContaining(`${APP_URL}/reset-password?token=`),
      );
    });
  });

  describe('rotateRefreshToken', () => {
    const invalidRefreshToken = new UnauthorizedError('Invalid refresh token');

    it('revokes the old token and returns its user', async () => {
      const user = buildUser();
      authRepository.findRefreshTokenByHash.mockResolvedValue(
        buildRefreshToken({ userId: user.id }),
      );
      authRepository.findUserById.mockResolvedValue(user);

      await expect(service.rotateRefreshToken(TOKEN)).resolves.toBe(user);
      expect(authRepository.findRefreshTokenByHash).toHaveBeenCalledWith(hashToken(TOKEN));
      expect(authRepository.revokeRefreshToken).toHaveBeenCalledWith(hashToken(TOKEN));
    });

    it.each([
      { name: 'unknown', record: undefined },
      { name: 'revoked', record: buildRefreshToken({ revokedAt: new Date() }) },
      { name: 'expired', record: buildRefreshToken({ expiresAt: anHourAgo() }) },
    ])(
      'throws UnauthorizedError for a $name token without revoking anything',
      async ({ record }) => {
        authRepository.findRefreshTokenByHash.mockResolvedValue(record);

        await expect(service.rotateRefreshToken(TOKEN)).rejects.toThrow(invalidRefreshToken);
        expect(authRepository.revokeRefreshToken).not.toHaveBeenCalled();
      },
    );

    it.each([
      { name: 'no longer exists', user: undefined },
      { name: 'is inactive', user: buildUser({ isActive: false }) },
    ])('throws UnauthorizedError when the token owner $name', async ({ user }) => {
      authRepository.findRefreshTokenByHash.mockResolvedValue(buildRefreshToken());
      authRepository.findUserById.mockResolvedValue(user);

      await expect(service.rotateRefreshToken(TOKEN)).rejects.toThrow(invalidRefreshToken);
    });
  });
});
