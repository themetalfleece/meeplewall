import { eq, sql } from 'drizzle-orm';

import type { DatabaseExecutor } from '../database.ts';
import { bggGames, type BggGame, type NewBggGame } from '../schema/index.ts';

export type GameInput = Omit<NewBggGame, 'createdAt' | 'updatedAt'>;

export async function getGame(
  database: DatabaseExecutor,
  { bggId }: { bggId: number },
): Promise<BggGame | undefined> {
  const [game] = await database.select().from(bggGames).where(eq(bggGames.id, bggId));

  return game;
}

/**
 * Inserts a game, or updates it when the BGG id already exists. Fields left
 * undefined keep their stored value on update.
 */
export async function upsertGame(
  database: DatabaseExecutor,
  { game }: { game: GameInput },
): Promise<BggGame> {
  const [saved] = await database
    .insert(bggGames)
    .values(game)
    .onConflictDoUpdate({ target: bggGames.id, set: { ...game, updatedAt: sql`now()` } })
    .returning();
  if (saved === undefined) {
    throw new Error(`Upserting BGG game ${game.id} returned no row`);
  }

  return saved;
}
