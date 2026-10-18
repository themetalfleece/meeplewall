import type { GameBoxInput } from '@board-games/renderer';

export interface GameBoxViewerProps {
  game: GameBoxInput;
  /** Read by screen readers in place of the canvas. */
  label: string;
}
