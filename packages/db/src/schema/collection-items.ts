import {
  boolean,
  doublePrecision,
  index,
  integer,
  pgTable,
  primaryKey,
  smallint,
  uuid,
} from 'drizzle-orm/pg-core';

import { bggGames } from './bgg-games.ts';
import { userCollections } from './user-collections.ts';

export const collectionItems = pgTable(
  'collection_items',
  {
    collectionId: uuid('collection_id')
      .notNull()
      .references(() => userCollections.id, { onDelete: 'cascade' }),
    bggGameId: integer('bgg_game_id')
      .notNull()
      .references(() => bggGames.id),
    owned: boolean('owned').notNull().default(false),
    previouslyOwned: boolean('previously_owned').notNull().default(false),
    forTrade: boolean('for_trade').notNull().default(false),
    wantInTrade: boolean('want_in_trade').notNull().default(false),
    wantToPlay: boolean('want_to_play').notNull().default(false),
    wantToBuy: boolean('want_to_buy').notNull().default(false),
    wishlist: boolean('wishlist').notNull().default(false),
    /** 1 (must have) to 5 (don't buy this), or null when not wishlisted or unknown. */
    wishlistPriority: smallint('wishlist_priority'),
    preordered: boolean('preordered').notNull().default(false),
    userRating: doublePrecision('user_rating'),
    sortIndex: integer('sort_index').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.collectionId, table.bggGameId] }),
    index('collection_items_bgg_game_id_index').on(table.bggGameId),
  ],
);

export type CollectionItem = typeof collectionItems.$inferSelect;
export type NewCollectionItem = typeof collectionItems.$inferInsert;
