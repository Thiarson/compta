import { inject } from 'vitest';

Object.assign(process.env, {
  DATABASE_URL: inject('databaseUrl'),
  REDIS_URL: '', // empty → in-memory rate limit store
  HOST: '127.0.0.1',
  PORT: '0',
  APP_URL: 'http://localhost:5173',
  ALLOWED_ORIGINS: 'http://localhost:5173',
  JWT_ACCESS_TOKEN_SECRET: 'test-access-secret-at-least-32-chars!!',
  JWT_REFRESH_TOKEN_SECRET: 'test-refresh-secret-at-least-32-chars!',
  EMAIL_FROM: 'test@compta.dev',
  EMAIL_API_KEY: 're_test_dummy',
});
