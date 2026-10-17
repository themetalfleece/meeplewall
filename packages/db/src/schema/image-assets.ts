import { bigint, integer, pgTable, text, unique } from 'drizzle-orm/pg-core';

import { bggGames } from './bgg-games.ts';
import { imageKind } from './enums.ts';
import { timestampDefaultNow } from './timestamps.ts';

/** A processed image in object storage. One per game and kind. */
export const imageAssets = pgTable(
  'image_assets',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    bggGameId: integer('bgg_game_id')
      .notNull()
      .references(() => bggGames.id, { onDelete: 'cascade' }),
    kind: imageKind('kind').notNull(),
    storageKey: text('storage_key').notNull(),
    contentType: text('content_type').notNull(),
    width: integer('width').notNull(),
    height: integer('height').notNull(),
    byteSize: integer('byte_size').notNull(),
    sideColor: text('side_color'),
    edgeColor: text('edge_color'),
    createdAt: timestampDefaultNow('created_at'),
  },
  (table) => [unique('image_assets_game_kind_unique').on(table.bggGameId, table.kind)],
);

export type ImageAsset = typeof imageAssets.$inferSelect;
export type NewImageAsset = typeof imageAssets.$inferInsert;
