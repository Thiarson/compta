import { randomUUID } from 'node:crypto';

import { API_URL, MAIL_URL } from './env';

import type { SentEmail } from './mail-server';

export interface TestUser {
  username: string;
  email: string;
  password: string;
  accountIds: string[];
}

export const newEmail = () => `user-${randomUUID().slice(0, 8)}@example.test`;

// Waits for an email to `to` whose subject contains `subject`, and returns the link in it.
export async function waitForEmailLink(to: string, subject: string, timeoutMs = 10_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const response = await fetch(`${MAIL_URL}/emails?to=${encodeURIComponent(to)}`);
    const emails = (await response.json()) as SentEmail[];
    const email = emails.findLast((candidate) => candidate.subject.includes(subject));
    const link = email?.html.match(/href="([^"]+)"/)?.[1];
    if (link) return link;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`No "${subject}" email for ${to} within ${timeoutMs}ms`);
}

async function post<T>(path: string, body: unknown, accessToken?: string) {
  const response = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`POST ${path} failed: ${response.status} ${await response.text()}`);
  }
  return (response.status === 204 ? null : await response.json()) as T;
}

// Registers and verifies a user through the API, optionally with some accounts.
// Each call spends one of the 5 registrations the API allows per 10 minutes, so the suite
// as a whole is budgeted: sign-up journey 1, session 1, password reset 1, accounts 2.
export async function createVerifiedUser(accountNames: string[] = []): Promise<TestUser> {
  const user = { username: 'Test User', email: newEmail(), password: 'correct-horse-1' };

  const { accessToken } = await post<{ accessToken: string }>('/auth/register', user);
  const link = await waitForEmailLink(user.email, 'Verify your Compta email');
  await post('/auth/verify-email', { verificationToken: new URL(link).searchParams.get('token') });

  const accountIds: string[] = [];
  for (const category of accountNames) {
    const account = await post<{ id: string }>('/accounts', { category }, accessToken);
    accountIds.push(account.id);
  }

  return { ...user, accountIds };
}
