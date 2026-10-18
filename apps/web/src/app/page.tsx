import { NotableCollections } from '@/components/NotableCollections';
import { UsernameForm } from '@/components/UsernameForm';

import styles from './page.module.css';

export default function HomePage() {
  return (
    <main className={styles.main}>
      <section className={styles.hero}>
        <h1 className={styles.title}>Board game collections, shelved as boxes.</h1>
        <p className={styles.lede}>
          Type a BoardGameGeek username to see their collection. The first visit fetches it from
          BGG, and it stays fresh for a day after that.
        </p>
        <UsernameForm />
      </section>
      <section className={styles.section}>
        <h2 className={styles.heading}>Collections to browse</h2>
        <NotableCollections />
      </section>
    </main>
  );
}
