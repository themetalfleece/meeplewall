import Link from 'next/link';

import { routes } from '@/lib/route-params';

import styles from './CollectionNav.module.css';
import type { NeighbourLinkProps } from './CollectionNav.types';

/** The previous or next game in the collection's order. */
export function NeighbourLink({ username, neighbour, direction }: NeighbourLinkProps) {
  const isPrevious = direction === 'previous';

  return (
    <Link
      className={styles.neighbour}
      href={routes.collectionGame({ username, bggId: neighbour.bggGameId })}
      rel={isPrevious ? 'prev' : 'next'}
    >
      <span className={styles.direction}>{isPrevious ? 'Previous' : 'Next'}</span>
      <span className={styles.neighbourName}>{neighbour.name}</span>
    </Link>
  );
}
