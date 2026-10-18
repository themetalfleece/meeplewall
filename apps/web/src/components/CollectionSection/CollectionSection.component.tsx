import { notFound } from 'next/navigation';
import { connection } from 'next/server';

import { CollectionGrid, GridSkeleton } from '@/components/CollectionGrid';
import { SyncWatcher } from '@/components/SyncWatcher';
import { loadCollectionPage } from '@/lib/collections';
import { parseUsername } from '@/lib/route-params';

import { describeGameCount } from './CollectionSection.data';
import styles from './CollectionSection.module.css';
import type { CollectionSectionProps } from './CollectionSection.types';

/**
 * A user's collection, read from Postgres on every request. A missing or day-old collection
 * starts a sync and shows the skeleton or the stale grid while the client polls.
 */
export async function CollectionSection({ params }: CollectionSectionProps) {
  const { uId } = await params;
  const username = parseUsername(uId);
  if (username === null) {
    notFound();
  }
  await connection();

  const page = await loadCollectionPage({ username });

  return (
    <>
      <header className={styles.header}>
        <h1 className={styles.title}>{page.displayName}&rsquo;s collection</h1>
        {page.cards !== null && (
          <p className={styles.count}>{describeGameCount(page.cards.length)}</p>
        )}
      </header>
      <SyncWatcher username={username} initialStatus={page.sync} fetchedAt={page.fetchedAt} />
      {page.cards === null ? (
        <GridSkeleton />
      ) : (
        <CollectionGrid username={page.displayName} cards={page.cards} />
      )}
    </>
  );
}
