import Link from 'next/link';

import { routes } from '@/lib/route-params';

import { NOTABLE_COLLECTIONS } from './NotableCollections.constants';
import styles from './NotableCollections.module.css';

export function NotableCollections() {
  return (
    <ul className={styles.list}>
      {NOTABLE_COLLECTIONS.map(({ username, blurb }) => (
        <li key={username}>
          <Link className={styles.card} href={routes.collection(username)}>
            <span className={styles.name}>{username}</span>
            <span className={styles.blurb}>{blurb}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
