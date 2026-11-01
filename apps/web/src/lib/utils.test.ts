import { describe, expect, it } from 'vitest';

import { formatCurrency, getInitials, isSameDay, toIsoDate } from './utils';

// Intl output uses non-breaking spaces; compare with plain ones.
const plain = (text: string) => text.replace(/\s/g, ' ');

describe('formatCurrency', () => {
  it('formats whole ariary amounts with thousands separators', () => {
    expect(plain(formatCurrency(1234567))).toBe('1 234 567 Ar');
  });

  it('formats zero and negative amounts', () => {
    expect(plain(formatCurrency(0))).toBe('0 Ar');
    expect(plain(formatCurrency(-500))).toBe('-500 Ar');
  });
});

describe('toIsoDate', () => {
  it('formats a local date as YYYY-MM-DD with zero padding', () => {
    expect(toIsoDate(new Date(2025, 0, 5))).toBe('2025-01-05');
  });

  it('uses the local calendar day, even just before midnight', () => {
    expect(toIsoDate(new Date(2025, 11, 31, 23, 59, 59))).toBe('2025-12-31');
  });
});

describe('isSameDay', () => {
  it('is true for two times on the same day', () => {
    expect(isSameDay(new Date(2025, 5, 1, 0, 0), new Date(2025, 5, 1, 23, 59))).toBe(true);
  });

  it('is false across midnight', () => {
    expect(isSameDay(new Date(2025, 5, 1, 23, 59), new Date(2025, 5, 2, 0, 0))).toBe(false);
  });
});

describe('getInitials', () => {
  it('uses the first letters of the first two words, uppercased', () => {
    expect(getInitials('jane doe smith')).toBe('JD');
  });

  it('handles a single word and surrounding whitespace', () => {
    expect(getInitials('  jane  ')).toBe('J');
  });
});
