import { notFound } from 'next/navigation';
import { connection } from 'next/server';

import { loadCollectionGame } from '@/lib/collections';
import { parseGameId, parseUsername, routes } from '@/lib/route-params';
import { parseShelf } from '@/lib/shelves';

import { BackLink } from './BackLink.component';
import { describePosition } from './CollectionNav.data';
import styles from './CollectionNav.module.css';
import type { CollectionNavProps } from './CollectionNav.types';
import { NeighbourLink } from './NeighbourLink.component';

/**
 * The way back to the user's collection, the game's place on the shelf it was opened from, and
 * the user's own flags. Read per request, since the collection changes with every sync.
 */
export async function CollectionNav({ params, searchParams }: CollectionNavProps) {
  const [{ uId, gId }, query] = await Promise.all([params, searchParams]);
  const username = parseUsername(uId);
  const bggId = parseGameId(gId);
  if (username === null || bggId === null) {
    notFound();
  }
  await connection();

  const entry = await loadCollectionGame({ username, bggId, shelf: parseShelf(query.shelf) });
  if (entry === null) {
    return (
      <nav className={styles.nav} aria-label={`${username}'s collection`}>
        <BackLink owner={username} href={routes.collection(username)} />
      </nav>
    );
  }

  const { displayName, shelf } = entry;

  return (
    <nav className={styles.nav} aria-label={`${displayName}'s collection`}>
      <BackLink
        owner={displayName}
        href={routes.collectionShelf({ username: displayName, shelf })}
      />
      <p className={styles.position}>{describePosition(entry)}</p>
      <ul className={styles.badges}>
        {entry.badges.map((badge) => (
          <li key={badge.kind} className={styles.badge}>
            {badge.label}
          </li>
        ))}
      </ul>
      <div className={styles.neighbours}>
        {entry.previous !== null && (
          <NeighbourLink
            username={displayName}
            shelf={shelf}
            neighbour={entry.previous}
            direction="previous"
          />
        )}
        {entry.next !== null && (
          <NeighbourLink
            username={displayName}
            shelf={shelf}
            neighbour={entry.next}
            direction="next"
          />
        )}
      </div>
    </nav>
  );
}
