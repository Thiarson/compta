import { describe, expect, it } from 'vitest';

import {
  validateAuthSearch,
  validateResetPasswordSearch,
  validateVerifyEmailSearch,
} from './auth.search';

describe('validateAuthSearch', () => {
  it('keeps a string redirect', () => {
    expect(validateAuthSearch({ redirect: '/accounts/1' })).toEqual({ redirect: '/accounts/1' });
  });

  it.each([42, ['/a'], { a: 1 }, null, undefined])(
    'drops a non-string redirect (%j)',
    (redirect) => {
      expect(validateAuthSearch({ redirect })).toEqual({ redirect: undefined });
    },
  );
});

describe('validateVerifyEmailSearch', () => {
  it('keeps redirect and token', () => {
    expect(validateVerifyEmailSearch({ redirect: '/x', token: 'abc' })).toEqual({
      redirect: '/x',
      token: 'abc',
    });
  });

  it('drops a non-string token', () => {
    expect(validateVerifyEmailSearch({ token: 123 }).token).toBeUndefined();
  });
});

describe('validateResetPasswordSearch', () => {
  it('keeps a string token', () => {
    expect(validateResetPasswordSearch({ token: 'abc' })).toEqual({ token: 'abc' });
  });

  it('drops a non-string token', () => {
    expect(validateResetPasswordSearch({ token: ['abc'] })).toEqual({ token: undefined });
  });
});
