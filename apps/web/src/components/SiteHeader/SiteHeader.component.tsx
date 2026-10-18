import Link from 'next/link';

import { SITE_NAME } from '@/lib/brand';
import { externalLinks } from '@/lib/external-links';
import { routes } from '@/lib/route-params';

import styles from './SiteHeader.module.css';

export function SiteHeader() {
  return (
    <header className={styles.header}>
      <Link href={routes.home()} className={styles.brand}>
        {SITE_NAME}
      </Link>
      <a className={styles.credit} href={externalLinks.bggHome} rel="noreferrer">
        Data from BoardGameGeek
      </a>
    </header>
  );
}
