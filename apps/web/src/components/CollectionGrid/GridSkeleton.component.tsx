import styles from './CollectionGrid.module.css';

const PLACEHOLDER_COUNT = 12;
const PLACEHOLDER_KEYS = [...Array(PLACEHOLDER_COUNT).keys()].map((index) => `slot-${index}`);

/** Empty cards that hold the grid's shape while the collection loads. */
export function GridSkeleton() {
  return (
    <ul className={styles.grid} aria-hidden="true">
      {PLACEHOLDER_KEYS.map((key) => (
        <li key={key} className={styles.skeleton} />
      ))}
    </ul>
  );
}
