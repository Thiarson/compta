import fp from 'fastify-plugin';
import fastifyJwt from '@fastify/jwt';

import { REFRESH_COOKIE_NAME } from '../constants/token.js';

import type { FastifyRequest } from 'fastify';

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: { sub: string };
  }
}

declare module 'fastify' {
  interface FastifyInstance {
    authenticate(request: FastifyRequest, reply: FastifyReply): Promise<void>;
  }

  interface FastifyRequest {
    verifyAccessToken<Decoded extends object = { sub: string }>(): Promise<Decoded>;
    verifyRefreshToken<Decoded extends object = { sub: string }>(options?: {
      onlyCookie?: boolean;
    }): Promise<Decoded>;
    accessTokenPayload: { sub: string } | null;
  }

  interface FastifyReply {
    signAccessToken(payload: { sub: string }): Promise<string>;
    signRefreshToken(payload: { sub: string }): Promise<string>;
  }
}

export default fp(async function jwtPlugin(app) {
  await app.register(fastifyJwt, {
    secret: app.config.JWT_ACCESS_TOKEN_SECRET,
    namespace: 'access',
    sign: { expiresIn: app.config.ACCESS_TOKEN_TTL },
    jwtVerify: 'verifyAccessToken',
    jwtSign: 'signAccessToken',
  });

  await app.register(fastifyJwt, {
    secret: app.config.JWT_REFRESH_TOKEN_SECRET,
    namespace: 'refresh',
    cookie: { cookieName: REFRESH_COOKIE_NAME, signed: false },
    sign: { expiresIn: `${app.config.REFRESH_TOKEN_TTL_DAYS}d` },
    jwtVerify: 'verifyRefreshToken',
    jwtSign: 'signRefreshToken',
  });

  app.decorateRequest('accessTokenPayload', null);

  app.decorate('authenticate', async (request: FastifyRequest) => {
    request.accessTokenPayload = await request.verifyAccessToken();
  });
});
