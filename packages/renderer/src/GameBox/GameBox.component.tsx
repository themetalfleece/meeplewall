'use client';

import { useGameBox } from './GameBox.hooks.js';
import type { GameBoxProps } from './GameBox.types.js';

/** A game's 3D box, filling its container. */
export function GameBox({ game, options, className }: GameBoxProps) {
  const containerRef = useGameBox({ game, options });

  return <div ref={containerRef} className={className} />;
}
