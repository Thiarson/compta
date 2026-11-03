import fastify from 'fastify';
import fp from 'fastify-plugin';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  EVENT_BATCH_SIZE,
  EVENT_RELAY_INTERVAL_MS,
  publishPendingEvents,
  startEventRelay,
} from '../../../src/workers/event.relay.js';

import type { Queue } from 'bullmq';
import type { EmailJob } from '../../../src/constants/queue.js';
import type { buildEventsRepository } from '../../../src/modules/notifications/events.repository.js';

type Db = Parameters<typeof publishPendingEvents>[0];
type EventsRepository = ReturnType<typeof buildEventsRepository>;

function buildEvent(eventId: string) {
  const payload: EmailJob = {
    to: 'alice@test.dev',
    template: 'verify-email',
    params: { username: 'alice', url: 'http://app.test/verify-email?token=abc' },
  };
  return { id: `row-${eventId}`, eventId, payload, createdAt: new Date() };
}

describe('publishPendingEvents', () => {
  const tx = { name: 'tx' };
  const db = { transaction: vi.fn() };
  const eventsRepository = { findPending: vi.fn(), deleteByIds: vi.fn() };
  const emailQueue = { add: vi.fn() };

  const run = () =>
    publishPendingEvents(
      db as unknown as Db,
      eventsRepository as unknown as EventsRepository,
      emailQueue as unknown as Queue<EmailJob>,
    );

  beforeEach(() => {
    vi.resetAllMocks();
    db.transaction.mockImplementation((callback: (tx: unknown) => unknown) => callback(tx));
  });

  it('does nothing when no event is waiting', async () => {
    eventsRepository.findPending.mockResolvedValue([]);

    await run();

    expect(emailQueue.add).not.toHaveBeenCalled();
    expect(eventsRepository.deleteByIds).not.toHaveBeenCalled();
  });

  it('enqueues each event with its event id as the job id, then deletes them', async () => {
    eventsRepository.findPending.mockResolvedValue([buildEvent('a'), buildEvent('b')]);

    await run();

    expect(eventsRepository.findPending).toHaveBeenCalledWith(EVENT_BATCH_SIZE, tx);
    expect(emailQueue.add).toHaveBeenNthCalledWith(
      1,
      'verify-email',
      expect.objectContaining({ to: 'alice@test.dev' }),
      { jobId: 'a' },
    );
    expect(emailQueue.add).toHaveBeenNthCalledWith(2, 'verify-email', expect.anything(), {
      jobId: 'b',
    });
    expect(eventsRepository.deleteByIds).toHaveBeenCalledExactlyOnceWith(['row-a', 'row-b'], tx);
  });

  it('deletes nothing when the queue fails, so the next tick tries again', async () => {
    eventsRepository.findPending.mockResolvedValue([buildEvent('a'), buildEvent('b')]);
    emailQueue.add.mockRejectedValue(new Error('redis down'));

    await expect(run()).rejects.toThrow('redis down');

    expect(eventsRepository.deleteByIds).not.toHaveBeenCalled();
  });
});

describe('startEventRelay', () => {
  const transaction = vi.fn();

  async function bootApp() {
    const app = fastify({ logger: false });
    app.decorate('db', { transaction } as never);
    app.decorate('emailQueue', {} as never);
    await app.register(fp(async (instance) => startEventRelay(instance)));
    await app.ready();
    return app;
  }

  beforeEach(() => {
    vi.resetAllMocks();
    // Only the relay's timer is fake: Fastify's own startup must keep running
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('publishes on every interval once the app is ready, and stops when it closes', async () => {
    transaction.mockResolvedValue(undefined);
    const app = await bootApp();

    await vi.advanceTimersByTimeAsync(EVENT_RELAY_INTERVAL_MS * 3);
    expect(transaction).toHaveBeenCalledTimes(3);

    await app.close();
    await vi.advanceTimersByTimeAsync(EVENT_RELAY_INTERVAL_MS * 3);
    expect(transaction).toHaveBeenCalledTimes(3);
  });

  it('never runs two ticks at once', async () => {
    let finishTick!: () => void;
    transaction.mockReturnValue(new Promise<void>((resolve) => (finishTick = resolve)));
    const app = await bootApp();

    await vi.advanceTimersByTimeAsync(EVENT_RELAY_INTERVAL_MS * 3);
    expect(transaction).toHaveBeenCalledTimes(1); // the later intervals were skipped

    finishTick();
    await app.close();
  });

  it('keeps running after a tick fails', async () => {
    transaction.mockRejectedValueOnce(new Error('redis down')).mockResolvedValue(undefined);
    const app = await bootApp();

    await vi.advanceTimersByTimeAsync(EVENT_RELAY_INTERVAL_MS * 2);

    expect(transaction).toHaveBeenCalledTimes(2);
    await app.close();
  });
});
