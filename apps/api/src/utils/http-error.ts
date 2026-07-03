import type { FastifySchemaValidationError } from 'fastify';

export class HttpError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);

    this.name = this.constructor.name;
    this.code = code;
    this.status = status;
  }
}

export class ValidationError extends HttpError {
  details: FastifySchemaValidationError[];

  constructor(message: string, details: FastifySchemaValidationError[]) {
    super(400, 'VALIDATION_ERROR', message);
    this.details = details;
  }
}

export class BadRequestError extends HttpError {
  constructor(message: string) {
    super(400, 'BAD_REQUEST', message);
  }
}

export class UnauthorizedError extends HttpError {
  constructor(message: string) {
    super(403, 'UNAUTHORIZED', message);
  }
}

export class ForbiddenError extends HttpError {
  constructor(message: string) {
    super(403, 'FORBIDDEN', message);
  }
}

export class NotFoundError extends HttpError {
  constructor(message: string) {
    super(404, 'NOT_FOUND', message);
  }
}

export class ConflictError extends HttpError {
  constructor(message: string) {
    super(409, 'CONFLICT', message);
  }
}

export class InternalServerError extends HttpError {
  constructor(message: string) {
    super(500, 'INTERNAL_SERVER_ERROR', message);
  }
}
