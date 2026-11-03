import { vi } from 'vitest';

// Integration tests never talk to a real BullMQ/Redis: jobs are intercepted in helpers/app.ts.
vi.mock('bullmq', () => ({
  Queue: class {
    add = vi.fn();
    on = vi.fn();
    close = vi.fn();
  },
  Worker: class {
    on = vi.fn();
    close = vi.fn();
  },
}));

// Events are published by the `onSend` hook in helpers/app.ts, so the relay's timer must not run
// too: it would publish the same events at the same time.
vi.mock('../src/workers/event.relay.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../src/workers/event.relay.js')>()),
  startEventRelay: vi.fn(),
}));
