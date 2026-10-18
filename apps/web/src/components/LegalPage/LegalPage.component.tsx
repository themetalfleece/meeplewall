import styles from './LegalPage.module.css';
import type { LegalPageProps } from './LegalPage.types';

/** The prose layout shared by the about and privacy pages. */
export function LegalPage({ title, children }: LegalPageProps) {
  return (
    <main className={styles.main}>
      <h1 className={styles.title}>{title}</h1>
      <div className={styles.body}>{children}</div>
    </main>
  );
}
