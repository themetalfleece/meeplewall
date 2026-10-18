import { notFound } from 'next/navigation';
import { connection } from 'next/server';

import { CollectionGrid, GridSkeleton } from '@/components/CollectionGrid';
import { SyncWatcher } from '@/components/SyncWatcher';
import { loadCollectionPage } from '@/lib/collections';
import { parseUsername } from '@/lib/route-params';
import { parseShelf } from '@/lib/shelves';

import { describeGameCount } from './CollectionSection.data';
import styles from './CollectionSection.module.css';
import type { CollectionSectionProps } from './CollectionSection.types';
import { ShelfTabs } from './ShelfTabs.component';

/**
 * One shelf of a user's collection, the owned games unless `?shelf=` names another, read from
 * Postgres on every request. A missing or day-old collection starts a sync and shows the skeleton
 * or the stale grid while the client polls.
 */
export async function CollectionSection({ params, searchParams }: CollectionSectionProps) {
  const [{ uId }, query] = await Promise.all([params, searchParams]);
  const username = parseUsername(uId);
  if (username === null) {
    notFound();
  }
  await connection();

  const page = await loadCollectionPage({ username, shelf: parseShelf(query.shelf) });

  return (
    <>
      <header className={styles.header}>
        <h1 className={styles.title}>{page.displayName}&rsquo;s collection</h1>
        {page.cards !== null && (
          <p className={styles.count}>{describeGameCount(page.cards.length)}</p>
        )}
      </header>
      {page.shelves.length > 1 && (
        <ShelfTabs username={page.displayName} shelves={page.shelves} current={page.shelf} />
      )}
      <SyncWatcher username={username} initialStatus={page.sync} fetchedAt={page.fetchedAt} />
      {page.cards === null ? (
        <GridSkeleton />
      ) : (
        <CollectionGrid username={page.displayName} shelf={page.shelf} cards={page.cards} />
      )}
    </>
  );
}
