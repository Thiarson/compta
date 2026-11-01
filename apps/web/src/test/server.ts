import { setupServer } from 'msw/node';

// No default handlers: each test declares the endpoints it needs via `server.use(...)`,
// and any unmocked request fails the test (see setup.ts).
export const server = setupServer();
