import type { GameView } from '@/lib/games';

export interface GameDetailProps {
  game: GameView;
}

export interface GameFact {
  label: string;
  value: string;
}
