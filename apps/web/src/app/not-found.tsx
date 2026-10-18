import Link from 'next/link';

import { routes } from '@/lib/route-params';

import styles from './not-found.module.css';

export default function NotFound() {
  return (
    <main className={styles.main}>
      <h1>Not found</h1>
      <p className={styles.text}>That collection or game is not here.</p>
      <Link href={routes.home()}>Back to the home page</Link>
    </main>
  );
}
