import type { Metadata } from 'next';
import { Suspense } from 'react';

import { CollectionNav, CollectionNavSkeleton } from '@/components/CollectionNav';
import { GameSection, GameSectionSkeleton } from '@/components/GameSection';
import { gameMetadata } from '@/lib/game-metadata';
import { parseUsername, type RouteSearchParams, type UserGameRouteProps } from '@/lib/route-params';

import styles from './page.module.css';

export async function generateMetadata({ params }: UserGameRouteProps): Promise<Metadata> {
  const { uId, gId } = await params;

  return gameMetadata({ segment: gId, username: parseUsername(uId) });
}

/**
 * A game in one user's collection. The game is the shared cached read of `/g/[gId]`; the
 * collection nav is a separate per-request boundary beside it, not nested inside it.
 */
export default function CollectionGamePage({
  params,
  searchParams,
}: UserGameRouteProps & RouteSearchParams) {
  return (
    <main className={styles.main}>
      <Suspense fallback={<CollectionNavSkeleton />}>
        <CollectionNav params={params} searchParams={searchParams} />
      </Suspense>
      <Suspense fallback={<GameSectionSkeleton />}>
        <GameSection params={params} />
      </Suspense>
    </main>
  );
}
