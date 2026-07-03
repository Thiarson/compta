import fp from 'fastify-plugin';
import {
  HttpError,
  NotFoundError,
  ValidationError,
  InternalServerError,
} from '../utils/http-error.js';

import type { FastifyError } from 'fastify';

export default fp(async function errorHandlerPlugin(app) {
  app.setNotFoundHandler((request) => {
    throw new NotFoundError(`Route ${request.method} ${request.url} not found`);
  });

  app.setErrorHandler((error: FastifyError | HttpError, request, reply) => {
    if ('validation' in error && error.validation) {
      const err = new ValidationError('Validation failed', error.validation);
      return reply.status(err.status).send({
        statusCode: err.status,
        code: err.code,
        message: err.message,
        details: err.details,
      });
    }

    if (error instanceof HttpError) {
      return reply.status(error.status).send({
        statusCode: error.status,
        code: error.code,
        message: error.message,
      });
    }

    app.log.error({ err: error, reqId: request.id }, error.message);

    const err = new InternalServerError('An unexpected error occurred');
    reply.status(err.status).send({
      statusCode: err.status,
      code: err.code,
      message: err.message,
    });
  });
});
