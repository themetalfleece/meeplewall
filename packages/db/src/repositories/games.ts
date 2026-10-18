import { eq, inArray, sql } from 'drizzle-orm';

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

/** Reads every stored game among `bggIds`, in no particular order. Unknown ids are skipped. */
export async function listGames(
  database: DatabaseExecutor,
  { bggIds }: { bggIds: number[] },
): Promise<BggGame[]> {
  if (bggIds.length === 0) {
    return [];
  }

  return database.select().from(bggGames).where(inArray(bggGames.id, bggIds));
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
