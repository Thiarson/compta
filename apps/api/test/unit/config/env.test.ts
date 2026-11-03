import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import fastify from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import envPlugin from '../../../src/config/env.js';

const REQUIRED_WITHOUT_DEFAULT = {
  APP_URL: 'http://localhost:5173',
  ALLOWED_ORIGINS: 'http://localhost:5173',
  DATABASE_URL: 'postgres://user:pass@localhost:5432/compta',
  REDIS_URL: 'redis://localhost:6379',
  JWT_ACCESS_TOKEN_SECRET: 'test-access-secret-at-least-32-chars!!',
  JWT_REFRESH_TOKEN_SECRET: 'test-refresh-secret-at-least-32-chars!',
  EMAIL_FROM: 'test@compta.dev',
  EMAIL_API_KEY: 're_test_dummy',
};

const WITH_DEFAULT = ['NODE_ENV', 'HOST', 'PORT', 'ACCESS_TOKEN_TTL', 'REFRESH_TOKEN_TTL_DAYS'];

const ALL_VARIABLES = [...Object.keys(REQUIRED_WITHOUT_DEFAULT), ...WITH_DEFAULT];

async function loadConfig() {
  const app = fastify({ logger: false });
  await app.register(envPlugin);
  await app.ready();
  const { config } = app;
  await app.close();
  return config;
}

describe('env config', () => {
  let emptyDir: string;

  beforeEach(() => {
    // The plugin reads `.env` from the cwd; point it at an empty dir so the
    // developer's real `.env` can never fill in variables a test removed.
    emptyDir = mkdtempSync(join(tmpdir(), 'compta-env-'));
    vi.spyOn(process, 'cwd').mockReturnValue(emptyDir);

    for (const name of ALL_VARIABLES) {
      vi.stubEnv(name, undefined);
    }
    for (const [name, value] of Object.entries(REQUIRED_WITHOUT_DEFAULT)) {
      vi.stubEnv(name, value);
    }
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    rmSync(emptyDir, { recursive: true, force: true });
  });

  it('loads the configuration when every required variable is set', async () => {
    await expect(loadConfig()).resolves.toMatchObject(REQUIRED_WITHOUT_DEFAULT);
  });

  describe('required variables', () => {
    it.each(Object.keys(REQUIRED_WITHOUT_DEFAULT))(
      'fails to boot when %s is missing',
      async (name) => {
        vi.stubEnv(name, undefined);

        await expect(loadConfig()).rejects.toThrow(name);
      },
    );
  });

  describe('defaults', () => {
    it('applies the documented defaults for unset optional variables', async () => {
      await expect(loadConfig()).resolves.toMatchObject({
        NODE_ENV: 'development',
        HOST: '0.0.0.0',
        PORT: '8000',
        ACCESS_TOKEN_TTL: '15m',
        REFRESH_TOKEN_TTL_DAYS: 30,
      });
    });

    it('prefers explicit values over defaults', async () => {
      vi.stubEnv('NODE_ENV', 'production');
      vi.stubEnv('HOST', '127.0.0.1');
      vi.stubEnv('PORT', '3000');
      vi.stubEnv('ACCESS_TOKEN_TTL', '5m');
      vi.stubEnv('REFRESH_TOKEN_TTL_DAYS', '7');
      vi.stubEnv('REDIS_URL', 'redis://cache:6379');

      await expect(loadConfig()).resolves.toMatchObject({
        NODE_ENV: 'production',
        HOST: '127.0.0.1',
        PORT: '3000',
        ACCESS_TOKEN_TTL: '5m',
        REFRESH_TOKEN_TTL_DAYS: 7,
        REDIS_URL: 'redis://cache:6379',
      });
    });
  });

  describe('type coercion', () => {
    it('coerces REFRESH_TOKEN_TTL_DAYS to a number', async () => {
      vi.stubEnv('REFRESH_TOKEN_TTL_DAYS', '14');

      const config = await loadConfig();

      expect(config.REFRESH_TOKEN_TTL_DAYS).toBe(14);
    });

    it('fails to boot when REFRESH_TOKEN_TTL_DAYS is not a number', async () => {
      vi.stubEnv('REFRESH_TOKEN_TTL_DAYS', 'a-lot');

      await expect(loadConfig()).rejects.toThrow('REFRESH_TOKEN_TTL_DAYS');
    });
  });
});
