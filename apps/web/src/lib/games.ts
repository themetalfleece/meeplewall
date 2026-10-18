import { getGame, listImageAssets } from '@meeplewall/db';
import type { GameBoxInput } from '@meeplewall/renderer';
import { cacheLife, cacheTag } from 'next/cache';

import { gameCacheTag } from './cache-tags';
import { storagePublicBaseUrl } from './env';
import { resolveGameImages, toGameBoxInput, type GameImages } from './game-view';
import { getDatabase } from './services';

/** A stored game with its images, as the game pages render it. */
export interface GameView {
  bggId: number;
  name: string;
  year: number | null;
  description: string | null;
  players: { min: number | null; max: number | null };
  playTime: { min: number | null; max: number | null };
  weight: number | null;
  averageRating: number | null;
  ratingCount: number | null;
  categories: string[];
  mechanics: string[];
  publisher: string | null;
  images: GameImages;
  box: GameBoxInput;
}

/**
 * Reads a stored game, cached for a day and expired early by the revalidate route once its
 * images are processed. A miss is cached for minutes only, so a game a sync stores later
 * appears soon.
 */
export async function loadGame({ bggId }: { bggId: number }): Promise<GameView | null> {
  'use cache';
  cacheTag(gameCacheTag(bggId));

  const database = getDatabase();
  const game = await getGame(database, { bggId });
  if (game === undefined) {
    cacheLife('minutes');
    return null;
  }
  cacheLife('days');

  const assets = await listImageAssets(database, { bggGameIds: [bggId] });
  const images = resolveGameImages({ game, assets, publicBaseUrl: storagePublicBaseUrl() });

  return {
    bggId: game.id,
    name: game.name,
    year: game.year,
    description: game.description,
    players: { min: game.minPlayers, max: game.maxPlayers },
    playTime: { min: game.minPlayTime, max: game.maxPlayTime },
    weight: game.weight,
    averageRating: game.averageRating,
    ratingCount: game.ratingCount,
    categories: game.categories,
    mechanics: game.mechanics,
    publisher: game.publisher,
    images,
    box: toGameBoxInput({ game, images }),
  };
}
