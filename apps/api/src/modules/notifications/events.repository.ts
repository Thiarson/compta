import { inArray } from 'drizzle-orm';
import { events } from '@compta/db';

import type { Database, DbTransaction, NewEvent } from '@compta/db';

export function buildEventsRepository(db: Database['db']) {
  return {
    async create(data: NewEvent, executor: Database['db'] | DbTransaction = db) {
      const [event] = await executor.insert(events).values(data).returning();
      return event;
    },

    async findPending(limit: number, executor: Database['db'] | DbTransaction = db) {
      return executor.select().from(events).orderBy(events.createdAt).limit(limit);
    },

    async deleteByIds(ids: string[], executor: Database['db'] | DbTransaction = db) {
      await executor.delete(events).where(inArray(events.id, ids));
    },
  };
}
