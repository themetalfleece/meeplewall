import { sql } from 'drizzle-orm';
import { pgTable, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

import { bggUsers } from './bgg-users.ts';
import { collectionSyncStatus } from './enums.ts';
import { optionalTimestamp, timestampDefaultNow } from './timestamps.ts';

/** One background sync of a user's collection, polled by the page that started it. */
export const collectionSyncs = pgTable(
  'collection_syncs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => bggUsers.id, { onDelete: 'cascade' }),
    status: collectionSyncStatus('status').notNull().default('running'),
    error: text('error'),
    startedAt: timestampDefaultNow('started_at'),
    finishedAt: optionalTimestamp('finished_at'),
  },
  (table) => [
    // At most one running sync per user, so concurrent first visits share it.
    uniqueIndex('collection_syncs_running_unique')
      .on(table.userId)
      .where(sql`${table.status} = 'running'`),
  ],
);

export type CollectionSync = typeof collectionSyncs.$inferSelect;
export type NewCollectionSync = typeof collectionSyncs.$inferInsert;
