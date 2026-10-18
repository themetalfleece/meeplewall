import Link from 'next/link';

import { externalLinks } from '@/lib/external-links';

import styles from './SiteHeader.module.css';

export function SiteHeader() {
  return (
    <header className={styles.header}>
      <Link href="/" className={styles.brand}>
        Meeplewall
      </Link>
      <a className={styles.credit} href={externalLinks.bggHome} rel="noreferrer">
        Data from BoardGameGeek
      </a>
    </header>
  );
}
