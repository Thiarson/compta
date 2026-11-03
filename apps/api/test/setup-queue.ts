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
