import fastify from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import errorHandlerPlugin from '../../../src/plugins/error-handler.js';
import { ConflictError, NotFoundError } from '../../../src/utils/http-error.js';

import type { FastifyInstance } from 'fastify';

function createError(message: string, props: { statusCode?: number; code?: string }) {
  return Object.assign(new Error(message), props);
}

describe('error-handler plugin', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = fastify({ logger: false });
    await app.register(errorHandlerPlugin);

    app.post(
      '/validated',
      {
        schema: {
          body: {
            type: 'object',
            required: ['name'],
            properties: { name: { type: 'string', minLength: 2 } },
          },
        },
      },
      () => ({ ok: true }),
    );
    app.get('/http-error', () => {
      throw new ConflictError('Email already in use');
    });
    app.get('/unmapped-status', () => {
      throw createError('Too large', { statusCode: 413, code: 'FST_ERR_CTP_BODY_TOO_LARGE' });
    });
    app.get('/rate-limited', () => {
      throw createError('Rate limit exceeded', { statusCode: 429 });
    });
    app.get('/no-code', () => {
      throw createError('Teapot', { statusCode: 418 });
    });
    app.get('/crash', () => {
      throw new Error('relation "users" does not exist');
    });
    app.get('/server-status', () => {
      throw createError('upstream exploded', { statusCode: 502 });
    });
    app.get('/not-found-http-error', () => {
      throw new NotFoundError('Account not found');
    });

    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('validation errors', () => {
    it('responds 400 VALIDATION_ERROR with the validation details', async () => {
      const res = await app.inject({ method: 'POST', url: '/validated', payload: { name: 'a' } });

      expect(res.statusCode).toBe(400);
      expect(res.json()).toEqual({
        statusCode: 400,
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        details: [
          expect.objectContaining({
            keyword: 'minLength',
            instancePath: '/name',
          }),
        ],
      });
    });

    it('reports a missing required field', async () => {
      const res = await app.inject({ method: 'POST', url: '/validated', payload: {} });

      expect(res.statusCode).toBe(400);
      expect(res.json().details).toEqual([expect.objectContaining({ keyword: 'required' })]);
    });
  });

  describe('HttpError', () => {
    it('uses the status, code and message of the error', async () => {
      const res = await app.inject({ method: 'GET', url: '/http-error' });

      expect(res.statusCode).toBe(409);
      expect(res.json()).toEqual({
        statusCode: 409,
        code: 'CONFLICT',
        message: 'Email already in use',
      });
    });

    it('does not add a details field', async () => {
      const res = await app.inject({ method: 'GET', url: '/not-found-http-error' });

      expect(res.json()).not.toHaveProperty('details');
    });
  });

  describe('native errors with a client status code', () => {
    it('maps a known status through the code table', async () => {
      const res = await app.inject({ method: 'GET', url: '/rate-limited' });

      expect(res.statusCode).toBe(429);
      expect(res.json()).toEqual({
        statusCode: 429,
        code: 'TOO_MANY_REQUESTS',
        message: 'Rate limit exceeded',
      });
    });

    it('falls back to the error code when the status is not in the table', async () => {
      const res = await app.inject({ method: 'GET', url: '/unmapped-status' });

      expect(res.statusCode).toBe(413);
      expect(res.json()).toEqual({
        statusCode: 413,
        code: 'FST_ERR_CTP_BODY_TOO_LARGE',
        message: 'Too large',
      });
    });

    it('falls back to BAD_REQUEST when there is neither a mapping nor a code', async () => {
      const res = await app.inject({ method: 'GET', url: '/no-code' });

      expect(res.statusCode).toBe(418);
      expect(res.json().code).toBe('BAD_REQUEST');
    });

    it('answers 400 BAD_REQUEST for a malformed JSON body', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/validated',
        headers: { 'content-type': 'application/json' },
        payload: '{"name": ',
      });

      expect(res.statusCode).toBe(400);
      expect(res.json().code).toBe('BAD_REQUEST');
    });
  });

  describe('unexpected errors', () => {
    it.each([
      { name: 'a plain error', url: '/crash', internalMessage: 'relation "users" does not exist' },
      { name: 'a 5xx status error', url: '/server-status', internalMessage: 'upstream exploded' },
    ])('responds a generic 500 for $name', async ({ url, internalMessage }) => {
      const res = await app.inject({ method: 'GET', url });

      expect(res.statusCode).toBe(500);
      expect(res.json()).toEqual({
        statusCode: 500,
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected error occurred',
      });
      expect(res.body).not.toContain(internalMessage);
    });

    it('does not leak the stack trace', async () => {
      const res = await app.inject({ method: 'GET', url: '/crash' });

      expect(res.body).not.toMatch(/\bat\b.+\.ts/);
      expect(res.body).not.toContain('stack');
    });

    it('logs the original error with the request id', async () => {
      const logError = vi.spyOn(app.log, 'error');

      await app.inject({ method: 'GET', url: '/crash' });

      expect(logError).toHaveBeenCalledWith(
        expect.objectContaining({ err: expect.objectContaining({ message: expect.any(String) }) }),
        'relation "users" does not exist',
      );
    });

    it('does not log expected client errors as errors', async () => {
      const logError = vi.spyOn(app.log, 'error');

      await app.inject({ method: 'GET', url: '/http-error' });
      await app.inject({ method: 'POST', url: '/validated', payload: {} });

      expect(logError).not.toHaveBeenCalled();
    });
  });

  describe('not found handler', () => {
    it('responds 404 NOT_FOUND with the method and url in the message', async () => {
      const res = await app.inject({ method: 'GET', url: '/does-not-exist?x=1' });

      expect(res.statusCode).toBe(404);
      expect(res.json()).toEqual({
        statusCode: 404,
        code: 'NOT_FOUND',
        message: 'Route GET /does-not-exist?x=1 not found',
      });
    });

    it('uses the same error shape for an unsupported method on a known path', async () => {
      const res = await app.inject({ method: 'DELETE', url: '/http-error' });

      expect(res.statusCode).toBe(404);
      expect(Object.keys(res.json()).sort()).toEqual(['code', 'message', 'statusCode']);
    });
  });
});
