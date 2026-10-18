import { formatCount, formatRange, formatRating, formatWeight } from '@/lib/format';
import type { GameView } from '@/lib/games';

import type { GameFact } from './GameDetail.types';

/** The facts row under a game's title, skipping whatever BGG does not know. */
export function gameFacts(game: GameView): GameFact[] {
  const facts: (GameFact | null)[] = [
    toFact({ label: 'Players', value: formatRange({ ...game.players, unit: 'players' }) }),
    toFact({ label: 'Playing time', value: formatRange({ ...game.playTime, unit: 'min' }) }),
    toFact({ label: 'Weight', value: game.weight === null ? null : formatWeight(game.weight) }),
    toFact({ label: 'BGG rating', value: describeRating(game) }),
    toFact({ label: 'Publisher', value: game.publisher }),
  ];

  return facts.filter((fact) => fact !== null);
}

function toFact({ label, value }: { label: string; value: string | null }): GameFact | null {
  return value === null ? null : { label, value };
}

function describeRating({ averageRating, ratingCount }: GameView): string | null {
  if (averageRating === null) {
    return null;
  }
  if (ratingCount === null) {
    return formatRating(averageRating);
  }

  return `${formatRating(averageRating)} from ${formatCount(ratingCount)} ratings`;
}

/** Categories then mechanics, each once: BGG can file one term under both. */
export function gameTags(game: Pick<GameView, 'categories' | 'mechanics'>): string[] {
  return [...new Set([...game.categories, ...game.mechanics])];
}

/** The game's page on BoardGameGeek. */
export function bggGameUrl(bggId: number): string {
  return `https://boardgamegeek.com/boardgame/${bggId}`;
}
