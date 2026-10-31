import { randomUUID } from 'node:crypto';

import type {
  EmailVerificationToken,
  PasswordResetToken,
  RefreshToken,
  Transaction,
  User,
} from '@compta/db';

const HOUR_MS = 3_600_000;

export function buildUser(overrides: Partial<User> = {}): User {
  return {
    id: randomUUID(),
    username: 'alice',
    email: 'alice@test.dev',
    passwordHash: 'stored-hash',
    isActive: true,
    emailVerifiedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

export function buildTransaction(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: randomUUID(),
    accountId: randomUUID(),
    type: 'expense',
    amount: 1000,
    description: 'Groceries',
    date: '2026-01-15',
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    ...overrides,
  };
}

export function buildRefreshToken(overrides: Partial<RefreshToken> = {}): RefreshToken {
  return {
    id: randomUUID(),
    userId: randomUUID(),
    tokenHash: 'token-hash',
    expiresAt: new Date(Date.now() + HOUR_MS),
    revokedAt: null,
    createdAt: new Date(),
    ...overrides,
  };
}

type OneTimeToken = EmailVerificationToken & PasswordResetToken;

/** Shape shared by email-verification and password-reset tokens. */
export function buildOneTimeToken(overrides: Partial<OneTimeToken> = {}): OneTimeToken {
  return {
    id: randomUUID(),
    userId: randomUUID(),
    tokenHash: 'token-hash',
    usedAt: null,
    invalidatedAt: null,
    expiresAt: new Date(Date.now() + HOUR_MS),
    createdAt: new Date(),
    ...overrides,
  };
}

export const anHourAgo = () => new Date(Date.now() - HOUR_MS);
