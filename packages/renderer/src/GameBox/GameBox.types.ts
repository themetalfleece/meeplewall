import type { GameBoxInput, GameBoxOptions } from '../types.js';

export interface GameBoxProps {
  game: GameBoxInput;
  /** Read once on mount. Remount the component (change its `key`) to apply new options. */
  options?: GameBoxOptions;
  /** Sizes the container; the canvas fills it. */
  className?: string;
}
