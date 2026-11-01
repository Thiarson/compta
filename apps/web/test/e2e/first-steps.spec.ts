import { expect, test } from '@playwright/test';

import { newEmail, waitForEmailLink } from './support/api';
import { accountIdFromUrl, addTransaction, ar } from './support/ui';

test('a new user signs up, verifies their email and records a first transaction', async ({
  page,
}) => {
  const email = newEmail();

  await page.goto('/signup');
  await page.getByLabel('Username').fill('Jane Doe');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill('correct-horse-1');
  await page.getByLabel('Confirm Password').fill('correct-horse-1');
  await page.getByRole('button', { name: 'Create Account' }).click();

  await expect(page.getByText('Verify your email')).toBeVisible();

  // open the emailed link, as the user would
  await page.goto(await waitForEmailLink(email, 'Verify your Compta email'));
  await expect(page.getByText('Email verified')).toBeVisible();
  await page.getByRole('button', { name: 'Continue to dashboard' }).click();

  // every new account comes with a default "Personal" account
  await expect(page.getByRole('button', { name: 'Personal' })).toBeVisible();
  expect(accountIdFromUrl(page)).toBeTruthy();

  await addTransaction(page, { amount: 1500, description: 'Lunch' });

  await expect(page.getByRole('row', { name: /Lunch/ })).toContainText(ar(1500));
});
