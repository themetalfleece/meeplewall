import styles from './GameSection.module.css';

/** Holds the game layout's shape until the game streams in. */
export function GameSectionSkeleton() {
  return (
    <div className={styles.skeleton} aria-hidden="true">
      <div className={styles.box} />
      <div className={styles.lines}>
        <div className={styles.title} />
        <div className={styles.line} />
        <div className={styles.line} />
      </div>
    </div>
  );
}
