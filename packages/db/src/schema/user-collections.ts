import { integer, pgTable, timestamp, uuid } from 'drizzle-orm/pg-core';

import { bggUsers } from './bgg-users.ts';
import { collectionSource } from './enums.ts';

/** The latest fetched collection of a user. Each sync replaces it. */
export const userCollections = pgTable('user_collections', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .unique()
    .references(() => bggUsers.id, { onDelete: 'cascade' }),
  fetchedAt: timestamp('fetched_at', { withTimezone: true }).notNull(),
  source: collectionSource('source').notNull(),
  itemCount: integer('item_count').notNull(),
});

export type UserCollection = typeof userCollections.$inferSelect;
export type NewUserCollection = typeof userCollections.$inferInsert;
