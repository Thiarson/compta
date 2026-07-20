import fp from 'fastify-plugin';
import fastifyEnv from '@fastify/env';

interface ConfigSchema {
  NODE_ENV: string;
  HOST: string;
  PORT: string;
  APP_URL: string;
  ALLOWED_ORIGINS: string;
  DATABASE_URL: string;
  JWT_ACCESS_TOKEN_SECRET: string;
  JWT_REFRESH_TOKEN_SECRET: string;
  ACCESS_TOKEN_TTL: string;
  REFRESH_TOKEN_TTL_DAYS: number;
  EMAIL_FROM: string;
  EMAIL_API_KEY: string;
  REDIS_URL?: string;
}

declare module 'fastify' {
  interface FastifyInstance {
    config: ConfigSchema;
  }
}

const schema = {
  type: 'object',
  required: [
    'NODE_ENV',
    'HOST',
    'PORT',
    'APP_URL',
    'ALLOWED_ORIGINS',
    'DATABASE_URL',
    'JWT_ACCESS_TOKEN_SECRET',
    'JWT_REFRESH_TOKEN_SECRET',
    'EMAIL_FROM',
    'EMAIL_API_KEY',
  ],
  properties: {
    NODE_ENV: { type: 'string', default: 'development' },
    HOST: { type: 'string', default: '0.0.0.0' },
    PORT: { type: 'string', default: '8000' },
    APP_URL: { type: 'string' },
    ALLOWED_ORIGINS: { type: 'string' },
    DATABASE_URL: { type: 'string' },
    REDIS_URL: { type: 'string' },
    JWT_ACCESS_TOKEN_SECRET: { type: 'string' },
    JWT_REFRESH_TOKEN_SECRET: { type: 'string' },
    ACCESS_TOKEN_TTL: { type: 'string', default: '15m' },
    REFRESH_TOKEN_TTL_DAYS: { type: 'number', default: 30 },
    EMAIL_FROM: { type: 'string' },
    EMAIL_API_KEY: { type: 'string' },
  },
};

export default fp(async function envPlugin(app) {
  await app.register(fastifyEnv, {
    schema,
    dotenv: true,
    confKey: 'config',
  });
});
