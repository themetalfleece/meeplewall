import Link from 'next/link';

import { routes } from '@/lib/route-params';

import styles from './CollectionSection.module.css';
import type { ShelfTabsProps } from './CollectionSection.types';

/** Links to the collection's shelves, so the wishlist and the rest sit beside the main wall. */
export function ShelfTabs({ username, shelves, current }: ShelfTabsProps) {
  return (
    <nav aria-label="Shelves">
      <ul className={styles.shelves}>
        {shelves.map((tab) => (
          <li key={tab.shelf}>
            <Link
              className={styles.shelf}
              href={routes.collectionShelf({ username, shelf: tab.shelf })}
              aria-current={tab.shelf === current ? 'page' : undefined}
            >
              {tab.label} <span className={styles.shelfCount}>{tab.count}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
