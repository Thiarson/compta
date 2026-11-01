import { randomUUID } from 'node:crypto';
import { API, bearer, call, cookieValue } from './api.js';

import type { RegisterBody } from '@compta/contracts';
import type { TestApp } from './app.js';

export const PASSWORD = 'password123';

export function buildRegisterPayload(overrides: Partial<RegisterBody> = {}): RegisterBody {
  return {
    username: 'alice',
    email: `alice-${randomUUID()}@test.dev`,
    password: PASSWORD,
    ...overrides,
  };
}

export async function registerUser(app: TestApp, overrides: Partial<RegisterBody> = {}) {
  const payload = buildRegisterPayload(overrides);
  const res = await call(app, { method: 'POST', url: `${API}/auth/register`, payload });
  if (res.statusCode !== 201) {
    throw new Error(`registerUser failed: ${res.statusCode} ${res.body}`);
  }

  const { accessToken, user } = res.json();
  return {
    ...payload,
    user: user as { id: string; username: string; email: string; emailVerifiedAt: string | null },
    accessToken: accessToken as string,
    refreshToken: cookieValue(res, 'refreshToken')!,
    headers: bearer(accessToken),
  };
}

export function login(app: TestApp, email: string, password = PASSWORD) {
  return call(app, { method: 'POST', url: `${API}/auth/login`, payload: { email, password } });
}
