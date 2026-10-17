import { GameBoxScene } from './GameBoxScene.js';
import type { GameBoxHandle, GameBoxInput, GameBoxOptions } from './types.js';

/**
 * Renders a game's box into `element`, sized to fill it. The returned handle
 * swaps the game in place or tears everything down.
 */
export function mountGameBox({
  element,
  game,
  options = {},
}: {
  element: HTMLElement;
  game: GameBoxInput;
  options?: GameBoxOptions;
}): GameBoxHandle {
  let scene: GameBoxScene | null = new GameBoxScene({ element, game, options });

  return {
    update: (next) => scene?.update(next),
    unmount: () => {
      scene?.dispose();
      scene = null;
    },
  };
}
