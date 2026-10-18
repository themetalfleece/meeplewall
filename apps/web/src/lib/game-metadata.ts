import type { Metadata } from 'next';

import { loadGame } from './games';
import { parseGameId, routes } from './route-params';

const DESCRIPTION_LENGTH = 200;

function summarise({
  description,
  fallback,
}: {
  description: string | null;
  fallback: string;
}): string {
  if (description === null) {
    return fallback;
  }

  return description.length > DESCRIPTION_LENGTH
    ? `${description.slice(0, DESCRIPTION_LENGTH - 1).trimEnd()}…`
    : description;
}

/**
 * Metadata for a game page. Both game routes point their canonical URL at `/g/[gId]`, since a
 * game is the same page whichever collection it is viewed from.
 */
export async function gameMetadata({
  segment,
  username,
}: {
  segment: string;
  username: string | null;
}): Promise<Metadata> {
  const bggId = parseGameId(segment);
  const game = bggId === null ? null : await loadGame({ bggId });
  if (bggId === null || game === null) {
    return { title: 'Game not found', robots: { index: false } };
  }

  const title = username === null ? game.name : `${game.name} in ${username}'s collection`;

  return {
    title,
    description: summarise({
      description: game.description,
      fallback: `${game.name} on BoardGameGeek, as a 3D box.`,
    }),
    alternates: { canonical: routes.game(bggId) },
    openGraph: { title, type: 'website' },
  };
}
