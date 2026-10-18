import Link from 'next/link';
import { notFound } from 'next/navigation';
import { connection } from 'next/server';

import { loadCollectionGame } from '@/lib/collections';
import { parseGameId, parseUsername, routes } from '@/lib/route-params';

import { collectionBadges } from './CollectionNav.data';
import styles from './CollectionNav.module.css';
import type { CollectionNavProps } from './CollectionNav.types';
import { NeighbourLink } from './NeighbourLink.component';

/**
 * The way back to the user's collection, the game's place in it, and the user's own flags.
 * Read per request, since the collection changes with every sync.
 */
export async function CollectionNav({ params }: CollectionNavProps) {
  const { uId, gId } = await params;
  const username = parseUsername(uId);
  const bggId = parseGameId(gId);
  if (username === null || bggId === null) {
    notFound();
  }
  await connection();

  const entry = await loadCollectionGame({ username, bggId });
  const displayName = entry === null ? username : entry.displayName;

  return (
    <nav className={styles.nav} aria-label={`${displayName}'s collection`}>
      <Link className={styles.back} href={routes.collection(displayName)}>
        &larr; Back to {displayName}&rsquo;s collection
      </Link>
      {entry !== null && (
        <>
          <p className={styles.position}>
            {entry.position} of {entry.itemCount}
          </p>
          <ul className={styles.badges}>
            {collectionBadges(entry).map((badge) => (
              <li key={badge} className={styles.badge}>
                {badge}
              </li>
            ))}
          </ul>
          <div className={styles.neighbours}>
            {entry.previous !== null && (
              <NeighbourLink
                username={displayName}
                neighbour={entry.previous}
                direction="previous"
              />
            )}
            {entry.next !== null && (
              <NeighbourLink username={displayName} neighbour={entry.next} direction="next" />
            )}
          </div>
        </>
      )}
    </nav>
  );
}
