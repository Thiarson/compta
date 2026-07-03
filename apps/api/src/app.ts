import fastify from 'fastify';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import autoload from '@fastify/autoload';

import envPlugin from './plugins/env.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function buildServer() {
  const app = fastify({
    logger: {
      level: 'info',
    },
  });

  await app.register(envPlugin);

  await app.register(autoload, {
    dir: join(__dirname, 'plugins'),
    ignorePattern: /^env\.(js|ts)$/,
  });

  await app.register(autoload, {
    dir: join(__dirname, 'modules'),
  });

  return app;
}

export default buildServer;
