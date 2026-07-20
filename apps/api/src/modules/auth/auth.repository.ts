import { eq } from 'drizzle-orm';
import { users, refreshTokens, emailVerificationTokens } from '@compta/db';

import type { Database, NewUser, NewRefreshToken, NewEmailVerificationToken } from '@compta/db';

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
      await db.insert(emailVerificationTokens).values(data);
    },
  };
}
