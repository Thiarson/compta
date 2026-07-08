import fastify from 'fastify';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import autoload from '@fastify/autoload';

import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';

import envPlugin from './config/env.js';
import healthRoutes from './modules/health/health.route.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function buildServer() {
  const app = fastify({
    logger: {
      level: 'info',
    },
  }).withTypeProvider<TypeBoxTypeProvider>();

  await app.register(envPlugin);

  await app.register(autoload, {
    dir: join(__dirname, 'plugins'),
  });

  await app.register(healthRoutes);

  await app.register(autoload, {
    dir: join(__dirname, 'modules'),
    ignorePattern: /^health$/,
    options: { prefix: '/api/v1' },
  });

  return app;
}

export default buildServer;
