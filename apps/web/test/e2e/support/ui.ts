import { expect } from '@playwright/test';

import type { Page } from '@playwright/test';

import type { TestUser } from './api';

// Fills the login form and submits it. Each call counts towards the API's 10 logins / minute.
export async function logIn(
  page: Page,
  user: Pick<TestUser, 'email' | 'password'>,
  password = user.password,
) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(user.email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Login' }).click();
}

export async function logOut(page: Page) {
  await page.getByRole('button', { name: /@example\.test/ }).click();
  await page.getByRole('menuitem', { name: 'Log out' }).click();
  await expect(page).toHaveURL(/\/login/);
}

export const accountIdFromUrl = (page: Page) => page.url().match(/\/accounts\/([^/?#]+)/)![1];

// Creates an account from the switcher and waits until it is the open one.
export async function addAccount(page: Page, name: string, switcherLabel: string | RegExp) {
  await page.getByRole('button', { name: switcherLabel }).click();
  await page.getByRole('menuitem', { name: /Add account/ }).click();
  await page.getByLabel('Account name').fill(name);
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByRole('button', { name, exact: true })).toBeVisible();
}

export async function addTransaction(
  page: Page,
  {
    type = 'expense',
    amount,
    description,
  }: { type?: 'income' | 'expense'; amount: number; description: string },
) {
  await page.getByRole('button', { name: 'Add transaction' }).click();
  const dialog = page.getByRole('dialog');
  if (type === 'income') {
    await dialog.getByRole('combobox').click();
    await page.getByRole('option', { name: 'Income' }).click();
  }
  await dialog.getByLabel('Amount (Ar)').fill(String(amount));
  await dialog.getByLabel('Description').fill(description);
  await dialog.getByRole('button', { name: 'Add transaction' }).click();
  await expect(page.getByRole('cell', { name: description, exact: true })).toBeVisible();
}

// Matches a formatted amount whatever kind of space Intl puts between the digits: 1500 → /1\s500\sAr/
export const ar = (amount: number) =>
  new RegExp(`${String(amount).replace(/\B(?=(\d{3})+(?!\d))/g, '\\s')}\\sAr`);
