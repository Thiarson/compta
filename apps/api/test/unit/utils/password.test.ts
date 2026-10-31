import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from '../../../src/utils/password.js';

describe('password utils', () => {
  const password = 'correct-horse-battery-staple';

  describe('hashPassword', () => {
    it('produces an argon2id hash', async () => {
      const hash = await hashPassword(password);

      expect(hash).toMatch(/^\$argon2id\$/);
    });

    it('never contains the plaintext password', async () => {
      const hash = await hashPassword(password);

      expect(hash).not.toContain(password);
    });

    it('produces a different hash each time thanks to the salt', async () => {
      const [first, second] = await Promise.all([hashPassword(password), hashPassword(password)]);

      expect(first).not.toBe(second);
    });
  });

  describe('verifyPassword', () => {
    it('returns true for the correct password', async () => {
      const hash = await hashPassword(password);

      await expect(verifyPassword(password, hash)).resolves.toBe(true);
    });

    it('returns false for a wrong password', async () => {
      const hash = await hashPassword(password);

      await expect(verifyPassword('wrong-password', hash)).resolves.toBe(false);
    });

    it('returns false when only the casing differs', async () => {
      const hash = await hashPassword(password);

      await expect(verifyPassword(password.toUpperCase(), hash)).resolves.toBe(false);
    });

    it('throws a descriptive error for a malformed hash', async () => {
      await expect(verifyPassword(password, 'not-a-valid-hash')).rejects.toThrow(
        'Failed to verify password',
      );
    });

    it('keeps the original error as the cause', async () => {
      await expect(verifyPassword(password, 'not-a-valid-hash')).rejects.toHaveProperty(
        'cause',
        expect.any(Error),
      );
    });
  });
});
