import { expect, test } from '@playwright/test';

import { createVerifiedUser, waitForEmailLink } from './support/api';
import { logIn } from './support/ui';

test('a forgotten password can be reset once, and only the new one works', async ({ page }) => {
  const user = await createVerifiedUser();
  const newPassword = 'a-brand-new-password-2';

  await page.goto('/forgot-password');
  await page.getByLabel('Email').fill(user.email);
  await page.getByRole('button', { name: 'Send reset link' }).click();
  await expect(page.getByText('Check your email')).toBeVisible();

  const link = await waitForEmailLink(user.email, 'Reset your Compta password');
  await page.goto(link);
  await page.getByLabel('New password', { exact: true }).fill(newPassword);
  await page.getByLabel('Confirm new password').fill(newPassword);
  await page.getByRole('button', { name: 'Reset password' }).click();
  await expect(page).toHaveURL(/\/login$/);

  // the old password no longer works...
  await logIn(page, user);
  await expect(page.getByText('Invalid email or password')).toBeVisible();

  // ...the new one does
  await logIn(page, user, newPassword);
  await expect(page.getByRole('button', { name: 'Personal' })).toBeVisible();

  // ...and the link is spent
  await page.goto(link);
  await expect(page.getByText('Link expired')).toBeVisible();
});
