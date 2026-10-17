import { type RefObject, useEffect, useRef, useState } from 'react';
import { mountGameBox } from '../mountGameBox.js';
import type { GameBoxHandle, GameBoxInput, GameBoxOptions } from '../types.js';

/**
 * Mounts the renderer into the returned container ref once, then pushes each
 * new `game` through `update` so the WebGL context survives prop changes.
 */
export function useGameBox({
  game,
  options,
}: {
  game: GameBoxInput;
  options: GameBoxOptions | undefined;
}): RefObject<HTMLDivElement | null> {
  const containerRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<GameBoxHandle | null>(null);
  const [initial] = useState(() => ({ game, options }));

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    const handle = mountGameBox({ element, game: initial.game, options: initial.options ?? {} });
    handleRef.current = handle;

    return () => {
      handle.unmount();
      handleRef.current = null;
    };
  }, [initial]);

  useEffect(() => {
    handleRef.current?.update(game);
  }, [game]);

  return containerRef;
}
