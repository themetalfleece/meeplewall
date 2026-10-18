'use client';

import { clsx } from 'clsx';
import dynamic from 'next/dynamic';

import styles from './GameBoxViewer.module.css';
import type { GameBoxViewerProps } from './GameBoxViewer.types';

// three.js is most of the game page's JavaScript, so it loads in its own chunk, in the browser
// only: the canvas needs WebGL and has nothing to server-render.
const GameBox = dynamic(
  () => import('@board-games/renderer/react').then((renderer) => renderer.GameBox),
  { ssr: false, loading: BoxPlaceholder },
);

function BoxPlaceholder() {
  return <div className={styles.placeholder} />;
}

/** The game's box in 3D: drag to turn it, scroll to zoom. */
export function GameBoxViewer({ game, label }: GameBoxViewerProps) {
  return (
    <figure className={styles.viewer} aria-label={label}>
      {/* clsx narrows the module class, typed as possibly undefined, to the string GameBox takes. */}
      <GameBox game={game} className={clsx(styles.canvas)} />
    </figure>
  );
}
