import { describe, expect, it } from 'vitest';

import { ApiError, getFieldErrors } from '@/lib/api-error';

const validationError = (details?: unknown) =>
  new ApiError(400, 'VALIDATION_ERROR', 'Validation failed', details);

describe('getFieldErrors', () => {
  it('returns the messages whose instancePath matches the field', () => {
    const error = validationError([
      { instancePath: '/email', params: {}, message: 'must be a valid email' },
      { instancePath: '/password', params: {}, message: 'too short' },
    ]);

    expect(getFieldErrors(error, 'email')).toEqual([{ message: 'must be a valid email' }]);
  });

  it('matches a required-property error by params.missingProperty', () => {
    const error = validationError([
      { instancePath: '', params: { missingProperty: 'email' }, message: 'is required' },
    ]);

    expect(getFieldErrors(error, 'email')).toEqual([{ message: 'is required' }]);
  });

  it('returns every message for the same field', () => {
    const error = validationError([
      { instancePath: '/password', params: {}, message: 'too short' },
      { instancePath: '/password', params: {}, message: 'needs a digit' },
    ]);

    expect(getFieldErrors(error, 'password')).toEqual([
      { message: 'too short' },
      { message: 'needs a digit' },
    ]);
  });

  it('returns nothing for a field with no error', () => {
    const error = validationError([{ instancePath: '/email', params: {}, message: 'bad' }]);

    expect(getFieldErrors(error, 'username')).toEqual([]);
  });

  it('returns nothing when details are missing', () => {
    expect(getFieldErrors(validationError(), 'email')).toEqual([]);
  });

  it('returns nothing for other error codes', () => {
    const error = new ApiError(401, 'UNAUTHORIZED', 'No', [
      { instancePath: '/email', params: {}, message: 'bad' },
    ]);

    expect(getFieldErrors(error, 'email')).toEqual([]);
  });

  it('returns nothing for a non-ApiError', () => {
    expect(getFieldErrors(new Error('boom'), 'email')).toEqual([]);
    expect(getFieldErrors(null, 'email')).toEqual([]);
  });
});
