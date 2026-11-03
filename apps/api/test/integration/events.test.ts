import { randomUUID } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { events } from '@compta/db';
import { setupTestApp } from '../helpers/app.js';
import { buildEventsRepository } from '../../src/modules/notifications/events.repository.js';
import { publishPendingEvents } from '../../src/workers/event.relay.js';

import type { Queue } from 'bullmq';
import type { EmailJob } from '../../src/constants/queue.js';

describe('event relay', () => {
  const ctx = setupTestApp();

  const job: EmailJob = {
    to: 'alice@test.dev',
    template: 'verify-email',
    params: { username: 'alice', url: 'http://app.test/verify-email?token=abc' },
  };

  function relayWith(add: ReturnType<typeof vi.fn>) {
    const repository = buildEventsRepository(ctx.app.db);
    return () =>
      publishPendingEvents(ctx.app.db, repository, { add } as unknown as Queue<EmailJob>);
  }

  async function saveEvents(count: number) {
    const eventIds = Array.from({ length: count }, () => randomUUID());
    await ctx.app.db.insert(events).values(eventIds.map((eventId) => ({ eventId, payload: job })));
    return eventIds;
  }

  it('publishes saved events, then removes them', async () => {
    const [eventId] = await saveEvents(1);
    const add = vi.fn();

    await relayWith(add)();

    expect(add).toHaveBeenCalledExactlyOnceWith('verify-email', job, { jobId: eventId });
    expect(await ctx.app.db.select().from(events)).toHaveLength(0);
  });

  it('keeps every event when the queue is unreachable, and publishes them once it is back', async () => {
    await saveEvents(2);
    const add = vi.fn().mockRejectedValue(new Error('redis down'));

    await expect(relayWith(add)()).rejects.toThrow('redis down');
    expect(await ctx.app.db.select().from(events)).toHaveLength(2);

    add.mockResolvedValue({});
    await relayWith(add)();
    expect(await ctx.app.db.select().from(events)).toHaveLength(0);
  });
});
