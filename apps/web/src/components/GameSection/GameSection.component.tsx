import { notFound } from 'next/navigation';

import { GameDetail } from '@/components/GameDetail';
import { loadGame } from '@/lib/games';
import { parseGameId } from '@/lib/route-params';

import type { GameSectionProps } from './GameSection.types';

/** A stored game from the cached read, or the not-found page when there is none. */
export async function GameSection({ params }: GameSectionProps) {
  const bggId = parseGameId((await params).gId);
  if (bggId === null) {
    notFound();
  }

  const game = await loadGame({ bggId });
  if (game === null) {
    notFound();
  }

  return <GameDetail game={game} />;
}
