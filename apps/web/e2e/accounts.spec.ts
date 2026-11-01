import { expect, test } from '@playwright/test';

import { KNOWN_ISSUES, expectNoA11yViolations } from './support/a11y';
import { createVerifiedUser } from './support/api';
import { accountIdFromUrl, addAccount, addTransaction, ar, logIn, logOut } from './support/ui';

test('accounts keep their own transactions, and users never see each other’s data', async ({
  page,
}) => {
  const [alice, bob] = [await createVerifiedUser(), await createVerifiedUser()];

  // --- Alice: two accounts, each with its own transactions
  await logIn(page, alice);
  await expect(page.getByRole('button', { name: 'Personal' })).toBeVisible();
  await addTransaction(page, { amount: 1000, description: 'Lunch' });

  await addAccount(page, 'Bank', 'Personal');
  const bankId = accountIdFromUrl(page);
  await addTransaction(page, { type: 'income', amount: 5000, description: 'Salary' });
  await expect(page.getByRole('cell', { name: 'Lunch' })).toHaveCount(0);
  await expect(page.getByText(ar(5000)).first()).toBeVisible();

  await page.getByRole('button', { name: 'Bank' }).click();
  await page.getByRole('menuitem', { name: /Personal/ }).click();
  await expect(page.getByRole('cell', { name: 'Lunch' })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Salary' })).toHaveCount(0);

  // real-browser checks jsdom cannot do, such as colour contrast
  await expectNoA11yViolations(page, { exclude: KNOWN_ISSUES });

  // --- deleting the open account moves on to the other one, data intact
  await page.getByRole('button', { name: 'Personal' }).click();
  await page.getByRole('button', { name: 'Delete Personal' }).click();
  await page.getByLabel(/to confirm/).fill('Personal');
  await page.getByRole('button', { name: 'Delete account' }).click();

  await expect(page).toHaveURL(new RegExp(`/accounts/${bankId}$`));
  await expect(page.getByRole('cell', { name: 'Salary' })).toBeVisible();

  await logOut(page);

  // --- Bob: sees only his own data, and cannot open Alice's account by its URL
  await logIn(page, bob);
  await expect(page.getByRole('button', { name: 'Personal' })).toBeVisible();
  const bobAccountId = accountIdFromUrl(page);
  await expect(page.getByText('Salary')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Bank' })).toHaveCount(0);

  await page.goto(`/accounts/${bankId}`);
  await expect(page).toHaveURL(new RegExp(`/accounts/${bobAccountId}$`));
});
