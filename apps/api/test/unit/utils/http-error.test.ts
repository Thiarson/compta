import { describe, expect, it } from 'vitest';
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  HttpError,
  InternalServerError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from '../../../src/utils/http-error.js';

import type { FastifySchemaValidationError } from 'fastify';

describe('HttpError subclasses', () => {
  it.each([
    { ErrorClass: BadRequestError, status: 400, code: 'BAD_REQUEST' },
    { ErrorClass: UnauthorizedError, status: 401, code: 'UNAUTHORIZED' },
    { ErrorClass: ForbiddenError, status: 403, code: 'FORBIDDEN' },
    { ErrorClass: NotFoundError, status: 404, code: 'NOT_FOUND' },
    { ErrorClass: ConflictError, status: 409, code: 'CONFLICT' },
    { ErrorClass: InternalServerError, status: 500, code: 'INTERNAL_SERVER_ERROR' },
  ])('$ErrorClass.name maps to $status $code', ({ ErrorClass, status, code }) => {
    const error = new ErrorClass('something went wrong');

    expect(error).toBeInstanceOf(HttpError);
    expect(error).toBeInstanceOf(Error);
    expect(error.status).toBe(status);
    expect(error.code).toBe(code);
    expect(error.message).toBe('something went wrong');
    expect(error.name).toBe(ErrorClass.name);
  });
});

describe('ValidationError', () => {
  const details = [
    {
      keyword: 'minLength',
      instancePath: '/password',
      schemaPath: '#/properties/password/minLength',
      params: { limit: 8 },
      message: 'Password must be at least 8 characters',
    },
  ] satisfies FastifySchemaValidationError[];

  it('maps to 400 VALIDATION_ERROR', () => {
    const error = new ValidationError('Validation failed', details);

    expect(error).toBeInstanceOf(HttpError);
    expect(error.status).toBe(400);
    expect(error.code).toBe('VALIDATION_ERROR');
    expect(error.message).toBe('Validation failed');
  });

  it('carries the validation details', () => {
    const error = new ValidationError('Validation failed', details);

    expect(error.details).toEqual(details);
  });
});
