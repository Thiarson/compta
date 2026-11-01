import { DrizzleQueryError } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { isUniqueViolation } from '../../../src/utils/db-error.js';

/** A failed query as drizzle throws it: the driver error (with its SQLSTATE) is the `cause`. */
const failedQuery = (cause: unknown) =>
  new DrizzleQueryError('insert into "users" ...', [], cause as Error);
const postgresError = (code: string) => Object.assign(new Error('db error'), { code });

describe('isUniqueViolation', () => {
  it('detects a unique violation', () => {
    expect(isUniqueViolation(failedQuery(postgresError('23505')))).toBe(true);
  });

  it.each([
    { name: 'another Postgres error', error: failedQuery(postgresError('23503')) },
    { name: 'a failed query without a cause', error: failedQuery(undefined) },
    { name: 'an error that is not a query failure', error: postgresError('23505') },
    { name: 'a non-error value', error: '23505' },
  ])('returns false for $name', ({ error }) => {
    expect(isUniqueViolation(error)).toBe(false);
  });
});
