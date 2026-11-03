import { eq } from 'drizzle-orm';
import { notifications } from '@compta/db';

import type { NotificationStatus } from '@compta/contracts';
import type { Database, DbTransaction, NewNotification } from '@compta/db';

export function buildNotificationsRepository(db: Database['db']) {
  return {
    async create(
      data: Pick<NewNotification, 'userId' | 'type'>,
      executor: Database['db'] | DbTransaction = db,
    ) {
      const [notification] = await executor.insert(notifications).values(data).returning();
      return notification;
    },

    async updateStatus(id: string, status: NotificationStatus) {
      await db.update(notifications).set({ status }).where(eq(notifications.id, id));
    },
  };
}
