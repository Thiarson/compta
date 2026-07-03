import fp from 'fastify-plugin';
import fastifyEnv from '@fastify/env';

interface ConfigSchema {
  NODE_ENV: string;
  PORT: string;
  ALLOWED_ORIGINS: string;
}

declare module 'fastify' {
  interface FastifyInstance {
    config: ConfigSchema;
  }
}

const schema = {
  type: 'object',
  required: ['NODE_ENV', 'PORT', 'ALLOWED_ORIGINS'],
  properties: {
    NODE_ENV: { type: 'string', default: 'development' },
    PORT: { type: 'string', default: '8000' },
    ALLOWED_ORIGINS: { type: 'string' },
  },
};

export default fp(async function envPlugin(app) {
  await app.register(fastifyEnv, { schema, dotenv: true });
});
