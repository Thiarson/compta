import { describe, expect, it } from 'vitest';
import { normalizeEmail } from '../../../src/utils/email.js';

describe('normalizeEmail', () => {
  it.each([
    { input: 'alice@test.dev', expected: 'alice@test.dev' },
    { input: 'Alice@Test.DEV', expected: 'alice@test.dev' },
    { input: '  alice@test.dev  ', expected: 'alice@test.dev' },
    { input: '\tALICE@test.dev\n', expected: 'alice@test.dev' },
  ])('turns "$input" into "$expected"', ({ input, expected }) => {
    expect(normalizeEmail(input)).toBe(expected);
  });
});
