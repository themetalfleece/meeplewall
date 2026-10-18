import type { GameBoxInput } from '@meeplewall/renderer';

export interface GameBoxViewerProps {
  game: GameBoxInput;
  /** Read by screen readers in place of the canvas. */
  label: string;
}
