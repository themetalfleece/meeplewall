import type { Metadata } from 'next';
import { Suspense } from 'react';

import { GameSection, GameSectionSkeleton } from '@/components/GameSection';
import { gameMetadata } from '@/lib/game-metadata';
import type { GameRouteProps } from '@/lib/route-params';

import styles from './page.module.css';

export async function generateMetadata({ params }: GameRouteProps): Promise<Metadata> {
  return gameMetadata({ segment: (await params).gId, username: null });
}

export default function GamePage({ params }: GameRouteProps) {
  return (
    <main className={styles.main}>
      <Suspense fallback={<GameSectionSkeleton />}>
        <GameSection params={params} />
      </Suspense>
    </main>
  );
}
