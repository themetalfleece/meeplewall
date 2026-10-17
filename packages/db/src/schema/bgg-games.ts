import { doublePrecision, integer, jsonb, pgTable, text } from 'drizzle-orm/pg-core';

import { timestampDefaultNow } from './timestamps.ts';

/** BGG game data, keyed by the BGG game id. */
export const bggGames = pgTable('bgg_games', {
  id: integer('id').primaryKey(),
  name: text('name').notNull(),
  year: integer('year'),
  description: text('description'),
  minPlayers: integer('min_players'),
  maxPlayers: integer('max_players'),
  minPlayTime: integer('min_play_time'),
  maxPlayTime: integer('max_play_time'),
  weight: doublePrecision('weight'),
  averageRating: doublePrecision('average_rating'),
  ratingCount: integer('rating_count'),
  categories: jsonb('categories').$type<string[]>().notNull().default([]),
  mechanics: jsonb('mechanics').$type<string[]>().notNull().default([]),
  publisher: text('publisher'),
  imageUrlRaw: text('image_url_raw'),
  thumbUrlRaw: text('thumb_url_raw'),
  boxWidthMm: doublePrecision('box_width_mm'),
  boxDepthMm: doublePrecision('box_depth_mm'),
  boxHeightMm: doublePrecision('box_height_mm'),
  createdAt: timestampDefaultNow('created_at'),
  updatedAt: timestampDefaultNow('updated_at'),
});

export type BggGame = typeof bggGames.$inferSelect;
export type NewBggGame = typeof bggGames.$inferInsert;
