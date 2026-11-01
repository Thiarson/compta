import { test } from '@playwright/test';

import { expectNoA11yViolations } from './support/a11y';

for (const path of ['/login', '/signup', '/forgot-password']) {
  test(`${path} has no accessibility violations`, async ({ page }) => {
    await page.goto(path);
    await page.getByRole('button').first().waitFor();

    await expectNoA11yViolations(page);
  });
}
