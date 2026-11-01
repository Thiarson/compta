// Fixed ports keep playwright.config.ts static; they are unusual enough not to clash with `pnpm dev`.
export const API_PORT = 8100;
export const MAIL_PORT = 8101;
export const WEB_PORT = 5174;

export const API_ORIGIN = `http://localhost:${API_PORT}`;
export const API_URL = `${API_ORIGIN}/api/v1`;
export const MAIL_URL = `http://localhost:${MAIL_PORT}`;
export const WEB_URL = `http://localhost:${WEB_PORT}`;
