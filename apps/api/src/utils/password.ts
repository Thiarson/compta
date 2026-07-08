import argon2 from 'argon2';

export async function hashPassword(plainPassword: string): Promise<string> {
  try {
    return await argon2.hash(plainPassword, {
      type: argon2.argon2id,
      memoryCost: 65536, // 64 MiB
      timeCost: 2,
      parallelism: 1,
    });
  } catch (err) {
    throw new Error('Failed to hash password', { cause: err });
  }
}

export async function verifyPassword(
  plainPassword: string,
  hashedPassword: string,
): Promise<boolean> {
  try {
    return await argon2.verify(hashedPassword, plainPassword);
  } catch (err) {
    throw new Error('Failed to verify password', { cause: err });
  }
}
