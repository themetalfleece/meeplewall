import Link from 'next/link';

import styles from './CollectionNav.module.css';
import type { BackLinkProps } from './CollectionNav.types';

/** The link back to the collection the game was opened from. */
export function BackLink({ owner, href }: BackLinkProps) {
  return (
    <Link className={styles.back} href={href}>
      &larr; Back to {owner}&rsquo;s collection
    </Link>
  );
}
