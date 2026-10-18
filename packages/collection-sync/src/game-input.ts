import { crossCheckBoxSize, type BggGame, type BggGameVersion } from '@board-games/boardgamegeek';
import type { GameInput } from '@board-games/db';

const MILLIMETRES_PER_CENTIMETRE = 10;

function toMillimetres(centimetres: number): number {
  return Math.round(centimetres * MILLIMETRES_PER_CENTIMETRE);
}

/**
 * Turns a fetched BGG game and its editions into the stored row. The box size
 * is the editions' cross-checked median, or null when no edition has
 * dimensions.
 */
export function toGameInput({
  game,
  versions,
}: {
  game: BggGame;
  versions: BggGameVersion[];
}): GameInput {
  const box = crossCheckBoxSize({ versions, title: game.name });

  return {
    id: game.bggId,
    name: game.name,
    year: game.yearPublished,
    description: game.description === '' ? null : game.description,
    minPlayers: game.players.min,
    maxPlayers: game.players.max,
    minPlayTime: game.playTime.min,
    maxPlayTime: game.playTime.max,
    weight: game.stats === null ? null : game.stats.weight,
    averageRating: game.stats === null ? null : game.stats.averageRating,
    ratingCount: game.stats === null ? null : game.stats.ratingCount,
    categories: game.categories.map((link) => link.name),
    mechanics: game.mechanics.map((link) => link.name),
    publisher: game.publishers[0]?.name ?? null,
    imageUrlRaw: game.imageUrl,
    thumbUrlRaw: game.thumbnailUrl,
    boxWidthMm: box === null ? null : toMillimetres(box.size.width),
    boxHeightMm: box === null ? null : toMillimetres(box.size.height),
    boxDepthMm: box === null ? null : toMillimetres(box.size.depth),
  };
}
