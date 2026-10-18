import type { Metadata } from 'next';
import { Suspense } from 'react';

import { CollectionSection, CollectionSectionSkeleton } from '@/components/CollectionSection';
import { parseUsername, routes, type UserRouteProps } from '@/lib/route-params';

import styles from './page.module.css';

export async function generateMetadata({ params }: UserRouteProps): Promise<Metadata> {
  const username = parseUsername((await params).uId);
  if (username === null) {
    return { title: 'Collection not found', robots: { index: false } };
  }

  return {
    title: `${username}'s collection`,
    description: `${username}'s board game collection from BoardGameGeek.`,
    alternates: { canonical: routes.collection(username) },
  };
}

export default function CollectionPage({ params }: UserRouteProps) {
  return (
    <main className={styles.main}>
      <Suspense fallback={<CollectionSectionSkeleton />}>
        <CollectionSection params={params} />
      </Suspense>
    </main>
  );
}
