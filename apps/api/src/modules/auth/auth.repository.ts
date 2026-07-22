import { and, eq, isNull } from 'drizzle-orm';
import { users, refreshTokens, emailVerificationTokens, passwordResetTokens } from '@compta/db';

import type {
  Database,
  NewUser,
  NewRefreshToken,
  NewEmailVerificationToken,
  NewPasswordResetToken,
} from '@compta/db';

export function buildAuthRepository(db: Database['db']) {
  return {
    async createUser(data: NewUser) {
      const [user] = await db.insert(users).values(data).returning();
      return user;
    },

    async findUserByEmail(email: string) {
      return db.query.users.findFirst({ where: eq(users.email, email) });
    },

    async findUserById(id: string) {
      return db.query.users.findFirst({ where: eq(users.id, id) });
    },

    async createRefreshToken(data: NewRefreshToken) {
      const [token] = await db.insert(refreshTokens).values(data).returning();
      return token;
    },

    async findRefreshTokenByHash(tokenHash: string) {
      return db.query.refreshTokens.findFirst({ where: eq(refreshTokens.tokenHash, tokenHash) });
    },

    async revokeRefreshToken(tokenHash: string) {
      await db
        .update(refreshTokens)
        .set({ revokedAt: new Date() })
        .where(eq(refreshTokens.tokenHash, tokenHash));
    },

    async createEmailVerificationToken(data: NewEmailVerificationToken) {
      await db.transaction(async (tx) => {
        await tx
          .update(emailVerificationTokens)
          .set({ invalidatedAt: new Date() })
          .where(eq(emailVerificationTokens.userId, data.userId));
        await tx.insert(emailVerificationTokens).values(data);
      });
    },

    async createPasswordResetToken(data: NewPasswordResetToken) {
      await db.transaction(async (tx) => {
        await tx
          .update(passwordResetTokens)
          .set({ invalidatedAt: new Date() })
          .where(eq(passwordResetTokens.userId, data.userId));
        await tx.insert(passwordResetTokens).values(data);
      });
    },

    async findVerificationTokenByHash(tokenHash: string) {
      return await db.query.emailVerificationTokens.findFirst({
        where: eq(emailVerificationTokens.tokenHash, tokenHash),
      });
    },

    async findPasswordResetTokenByHash(tokenHash: string) {
      return await db.query.passwordResetTokens.findFirst({
        where: eq(passwordResetTokens.tokenHash, tokenHash),
      });
    },

    async markEmailAsVerified(userId: string, tokenId: string) {
      return await db.transaction(async (tx) => {
        const updatedRows = await tx
          .update(emailVerificationTokens)
          .set({ usedAt: new Date() })
          .where(
            and(eq(emailVerificationTokens.id, tokenId), isNull(emailVerificationTokens.usedAt)),
          )
          .returning({ id: emailVerificationTokens.id });

        if (updatedRows.length === 0) {
          return false;
        }

        await tx.update(users).set({ emailVerifiedAt: new Date() }).where(eq(users.id, userId));
        return true;
      });
    },

    async markPasswordResetTokenAsUsed(tokenId: string) {
      const updatedRows = await db
        .update(passwordResetTokens)
        .set({ usedAt: new Date() })
        .where(and(eq(passwordResetTokens.id, tokenId), isNull(passwordResetTokens.usedAt)))
        .returning({ id: passwordResetTokens.id });

      return updatedRows.length === 0 ? false : true;
    },
  };
}
