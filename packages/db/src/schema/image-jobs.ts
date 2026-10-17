import { sql } from 'drizzle-orm';
import { bigint, index, integer, pgTable, text, uniqueIndex } from 'drizzle-orm/pg-core';

import { bggGames } from './bgg-games.ts';
import { imageJobStatus, imageKind } from './enums.ts';
import { optionalTimestamp, timestampDefaultNow } from './timestamps.ts';

export const imageJobs = pgTable(
  'image_jobs',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    bggGameId: integer('bgg_game_id')
      .notNull()
      .references(() => bggGames.id, { onDelete: 'cascade' }),
    kind: imageKind('kind').notNull(),
    status: imageJobStatus('status').notNull().default('pending'),
    attempts: integer('attempts').notNull().default(0),
    lastError: text('last_error'),
    lockedBy: text('locked_by'),
    lockedUntil: optionalTimestamp('locked_until'),
    createdAt: timestampDefaultNow('created_at'),
    updatedAt: timestampDefaultNow('updated_at'),
  },
  (table) => [
    // At most one open job per image, so enqueueing twice is a no-op.
    uniqueIndex('image_jobs_open_unique')
      .on(table.bggGameId, table.kind)
      .where(sql`${table.status} in ('pending', 'processing')`),
    index('image_jobs_claim_index').on(table.status, table.createdAt),
  ],
);

export type ImageJob = typeof imageJobs.$inferSelect;
export type NewImageJob = typeof imageJobs.$inferInsert;
