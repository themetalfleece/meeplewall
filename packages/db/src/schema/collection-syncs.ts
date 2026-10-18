import { sql } from 'drizzle-orm';
import { index, integer, pgTable, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

import { bggUsers } from './bgg-users.ts';
import { collectionSyncStatus, refreshSource } from './enums.ts';
import { optionalTimestamp, timestampDefaultNow } from './timestamps.ts';

/**
 * One sync of a user's collection. The page that asked for it polls the row; the sync worker
 * claims it with a lease. `running` covers both waiting for a worker and being worked on.
 */
export const collectionSyncs = pgTable(
  'collection_syncs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => bggUsers.id, { onDelete: 'cascade' }),
    status: collectionSyncStatus('status').notNull().default('running'),
    // Rows from before the worker were all started by a visit.
    source: refreshSource('source').notNull().default('api'),
    error: text('error'),
    attempts: integer('attempts').notNull().default(0),
    lockedBy: text('locked_by'),
    lockedUntil: optionalTimestamp('locked_until'),
    startedAt: timestampDefaultNow('started_at'),
    finishedAt: optionalTimestamp('finished_at'),
  },
  (table) => [
    // At most one running sync per user, so concurrent first visits share it.
    uniqueIndex('collection_syncs_running_unique')
      .on(table.userId)
      .where(sql`${table.status} = 'running'`),
    index('collection_syncs_claim_index')
      .on(table.startedAt)
      .where(sql`${table.status} = 'running'`),
  ],
);

export type CollectionSync = typeof collectionSyncs.$inferSelect;
export type NewCollectionSync = typeof collectionSyncs.$inferInsert;
