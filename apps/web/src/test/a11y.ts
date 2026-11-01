import axe from 'axe-core';
import { expect } from 'vitest';

// Runs axe-core on the rendered page and fails with a readable list of violations.
// Colour contrast is skipped: jsdom has no layout or computed colours to check.
export async function expectNoA11yViolations(root: Element = document.body) {
  const { violations } = await axe.run(root, { rules: { 'color-contrast': { enabled: false } } });

  expect(
    violations.map(
      (violation) =>
        `${violation.id}: ${violation.help} -> ${violation.nodes.map((node) => node.target.join(' ')).join(', ')}`,
    ),
  ).toEqual([]);
}
