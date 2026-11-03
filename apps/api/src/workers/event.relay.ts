import { buildEventsRepository } from '../modules/notifications/events.repository.js';

import type { Queue } from 'bullmq';
import type { Database } from '@compta/db';
import type { FastifyInstance } from 'fastify';
import type { EmailJob } from '../constants/queue.js';

type EventsRepository = ReturnType<typeof buildEventsRepository>;

export const EVENT_BATCH_SIZE = 50;
export const EVENT_RELAY_INTERVAL_MS = 1000;

/**
 * Publishes the events saved by requests, then deletes them, in one transaction.
 * If publishing fails, nothing is deleted and the next tick tries again.
 */
export async function publishPendingEvents(
  db: Database['db'],
  eventsRepository: EventsRepository,
  emailQueue: Queue<EmailJob>,
) {
  await db.transaction(async (tx) => {
    const pending = await eventsRepository.findPending(EVENT_BATCH_SIZE, tx);
    if (pending.length === 0) return;

    for (const event of pending) {
      const job = event.payload as EmailJob;
      await emailQueue.add(job.template, job, { jobId: event.eventId });
    }

    await eventsRepository.deleteByIds(
      pending.map((event) => event.id),
      tx,
    );
  });
}

export function startEventRelay(app: FastifyInstance) {
  const eventsRepository = buildEventsRepository(app.db);
  let timer: NodeJS.Timeout | undefined;
  let running: Promise<void> | undefined;

  async function tick() {
    try {
      await publishPendingEvents(app.db, eventsRepository, app.emailQueue);
    } catch (err) {
      app.log.error({ err }, 'event relay: tick failed');
    }
  }

  // Start once every plugin is loaded: the queue is registered after this one
  app.addHook('onReady', async () => {
    timer = setInterval(() => {
      if (running) return; // the previous tick is still going

      running = tick().finally(() => {
        running = undefined;
      });
    }, EVENT_RELAY_INTERVAL_MS);
  });

  app.addHook('onClose', async () => {
    clearInterval(timer);
    await running;
  });
}
