import type { InjectOptions } from 'fastify';
import type { TestApp } from './app.js';

export const API = '/api/v1';

let requestCount = 0;

function nextIp() {
  requestCount += 1;
  return `10.${(requestCount >> 16) & 255}.${(requestCount >> 8) & 255}.${requestCount & 255}`;
}

/**
 * `app.inject` with a unique client IP per call, so the per-IP rate limits
 * never leak between tests. Pass `remoteAddress` to pin one (rate-limit tests).
 */
export function call(app: TestApp, options: InjectOptions) {
  return app.inject({ remoteAddress: nextIp(), ...options });
}

export function bearer(accessToken: string) {
  return { authorization: `Bearer ${accessToken}` };
}

export function cookieValue(res: Awaited<ReturnType<typeof call>>, name: string) {
  return res.cookies.find((c) => c.name === name)?.value;
}

/** A copy of `object` without `key` (for "missing field" validation cases). */
export function omit<T extends object>(object: T, key: string) {
  return Object.fromEntries(Object.entries(object).filter(([k]) => k !== key));
}
