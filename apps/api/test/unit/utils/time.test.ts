import { describe, expect, it } from 'vitest';
import { daysToMs } from '../../../src/utils/time.js';

const MS_PER_DAY = 86_400_000;

describe('daysToMs', () => {
  it.each([
    { days: 0, expected: 0 },
    { days: 1, expected: MS_PER_DAY },
    { days: 30, expected: 30 * MS_PER_DAY },
    { days: 0.5, expected: MS_PER_DAY / 2 },
  ])('converts $days day(s) to $expected ms', ({ days, expected }) => {
    expect(daysToMs(days)).toBe(expected);
  });
});
