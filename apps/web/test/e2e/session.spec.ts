import { expect, test } from '@playwright/test';

import { createVerifiedUser } from './support/api';
import { addAccount, logIn } from './support/ui';

import type { TestUser } from './support/api';

let user: TestUser;

test.beforeAll(async () => {
  user = await createVerifiedUser(['Cash']);
});

test('a visitor is sent to log in, then back to the page they asked for', async ({ page }) => {
  const target = `/accounts/${user.accountIds[0]}`;

  await page.goto(target);
  await expect(page).toHaveURL(/\/login\?redirect=/);

  await page.getByLabel('Email').fill(user.email);
  await page.getByLabel('Password', { exact: true }).fill(user.password);
  await page.getByRole('button', { name: 'Login' }).click();

  await expect(page).toHaveURL(new RegExp(`${target}$`));
  await expect(page.getByRole('button', { name: 'Cash', exact: true })).toBeVisible();
});

test('the session survives a reload and ends when the refresh cookie is gone', async ({
  page,
  context,
}) => {
  await logIn(page, user);
  await expect(page.getByRole('button', { name: 'Personal' })).toBeVisible();

  // the access token lives in memory, so a reload has to restore the session from the cookie
  await page.reload();
  await expect(page.getByRole('button', { name: 'Personal' })).toBeVisible();

  await context.clearCookies();
  await page.reload();

  await expect(page).toHaveURL(/\/login\?redirect=/);
});

test('an expired access token is refreshed without the user noticing', async ({ page }) => {
  await logIn(page, user);
  await expect(page.getByRole('button', { name: 'Personal' })).toBeVisible();

  // the API says "expired" to the first write, as it would after the token's 15 minutes
  let expired = false;
  await page.route('**/api/v1/accounts', async (route) => {
    if (route.request().method() !== 'POST' || expired) return route.continue();
    expired = true;
    await route.fulfill({
      status: 401,
      contentType: 'application/json',
      headers: {
        'access-control-allow-origin': 'http://localhost:5174',
        'access-control-allow-credentials': 'true',
      },
      body: JSON.stringify({ statusCode: 401, code: 'UNAUTHORIZED', message: 'Token expired' }),
    });
  });
  const refreshed = page.waitForResponse(
    (response) => response.url().endsWith('/auth/refresh') && response.ok(),
  );

  await addAccount(page, 'Savings', 'Personal');

  await refreshed;
  await expect(page.getByRole('button', { name: 'Savings', exact: true })).toBeVisible();
});
