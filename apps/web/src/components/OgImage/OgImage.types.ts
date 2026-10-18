import type { CollectionSummary } from '@/lib/collections';
import type { GameView } from '@/lib/games';

export interface GameOgImageProps {
  /** Null draws the not-found card. */
  game: Pick<GameView, 'name' | 'year' | 'images'> | null;
  /** Set on a collection game page, naming the collection. */
  collectionOf: string | null;
}

export interface CollectionOgImageProps {
  /** Null when the collection was never stored; the card then names `username` alone. */
  summary: CollectionSummary | null;
  username: string | null;
}
