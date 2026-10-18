import Image from 'next/image';
import Link from 'next/link';

import { externalLinks } from '@/lib/external-links';
import { routes } from '@/lib/route-params';

import styles from './SiteFooter.module.css';

export function SiteFooter() {
  return (
    <footer className={styles.footer}>
      <a className={styles.logo} href={externalLinks.bggHome} rel="noreferrer">
        <Image src="/powered-by-bgg-reversed.svg" alt="Powered by BGG" width={171} height={38} />
      </a>
      <p className={styles.notice}>
        Game data and images come from BoardGameGeek. Meeplewall is an independent fan project, not
        affiliated with or endorsed by BoardGameGeek. Game names and box art belong to their
        publishers.
      </p>
      <nav className={styles.links} aria-label="Site information">
        <Link href={routes.about()}>About</Link>
        <Link href={routes.privacy()}>Privacy</Link>
        <a href={externalLinks.sourceCode} rel="noreferrer">
          Source code
        </a>
      </nav>
    </footer>
  );
}
