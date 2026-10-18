import Link from 'next/link';

import styles from './SiteHeader.module.css';

export function SiteHeader() {
  return (
    <header className={styles.header}>
      <Link href="/" className={styles.brand}>
        Board Games
      </Link>
      <a className={styles.credit} href="https://boardgamegeek.com" rel="noreferrer">
        Data from BoardGameGeek
      </a>
    </header>
  );
}
