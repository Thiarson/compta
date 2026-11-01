import { DrizzleQueryError } from 'drizzle-orm';

const UNIQUE_VIOLATION = '23505'; // Postgres SQLSTATE

/** True when a query failed on a unique constraint (drizzle wraps the driver error in `cause`). */
export function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof DrizzleQueryError &&
    error.cause instanceof Error &&
    'code' in error.cause &&
    error.cause.code === UNIQUE_VIOLATION
  );
}
