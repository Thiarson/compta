import AxeBuilder from '@axe-core/playwright';
import { expect } from '@playwright/test';

import type { Page } from '@playwright/test';

// Axe in a real browser, which also checks what jsdom cannot (colour contrast, page-level rules).
export async function expectNoA11yViolations(page: Page, { exclude = [] as string[] } = {}) {
  const builder = exclude.reduce(
    (axe, selector) => axe.exclude(selector),
    new AxeBuilder({ page }),
  );
  const { violations } = await builder.analyze();

  expect(
    violations.map(
      (violation) =>
        `${violation.id}: ${violation.help} -> ${violation.nodes.map((node) => node.target.join(' ')).join(', ')}`,
    ),
  ).toEqual([]);
}

// Known, accepted-for-now findings, kept narrow so any new violation still fails the test:
export const KNOWN_ISSUES = [
  // react-day-picker labels a day button with its full date while showing only the day number
  '[data-day]',
  // shadcn / Sonner default colours just under the 4.5:1 contrast minimum (4.0 – 4.34:1)
  '[data-slot="avatar-fallback"]',
  '[data-slot="badge"]',
  '[data-sonner-toast]',
];
