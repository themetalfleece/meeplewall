import type { Metadata } from 'next';
import Link from 'next/link';

import { routes } from '@/lib/route-params';

import styles from './page.module.css';

export const metadata: Metadata = {
  title: 'Offline',
  robots: { index: false },
};

/** What the service worker serves for any page but the home page while the device is offline. */
export default function OfflinePage() {
  return (
    <main className={styles.main}>
      <h1>You are offline</h1>
      <p className={styles.text}>
        Collections and games load from the network. Reconnect and try again.
      </p>
      <Link href={routes.home()}>Back to the home page</Link>
    </main>
  );
}
