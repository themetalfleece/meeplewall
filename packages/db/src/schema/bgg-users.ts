import { sql } from 'drizzle-orm';
import { pgTable, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

import { optionalTimestamp, timestampDefaultNow } from './timestamps.ts';

export const bggUsers = pgTable(
  'bgg_users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    bggUsername: text('bgg_username').notNull(),
    firstSeenAt: timestampDefaultNow('first_seen_at'),
    lastSyncedAt: optionalTimestamp('last_synced_at'),
  },
  // BGG usernames are case-insensitive, so `/u/Alice` and `/u/alice` are one user.
  (table) => [uniqueIndex('bgg_users_bgg_username_unique').on(sql`lower(${table.bggUsername})`)],
);

export type BggUser = typeof bggUsers.$inferSelect;
export type NewBggUser = typeof bggUsers.$inferInsert;
