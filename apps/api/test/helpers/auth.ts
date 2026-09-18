import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';

export async function registerUser(app: FastifyInstance, overrides: Record<string, string> = {}) {
  const body = {
    username: 'alice',
    email: `alice-${randomUUID()}@test.dev`,
    password: 'password123',
    ...overrides,
  };
  const res = await app.inject({ method: 'POST', url: '/api/v1/auth/register', payload: body });
  const { accessToken, user } = res.json();
  const refreshToken = res.cookies.find((c) => c.name === 'refreshToken')!.value;
  return {
    ...body,
    user,
    accessToken,
    refreshToken,
    headers: { authorization: `Bearer ${accessToken}` },
  };
}
