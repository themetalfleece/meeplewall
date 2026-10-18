import { SKELETON_CARD_KEYS } from './CollectionGrid.constants';
import styles from './CollectionGrid.module.css';

/** Empty cards that hold the grid's shape while the collection loads. */
export function GridSkeleton() {
  return (
    <ul className={styles.grid} aria-hidden="true">
      {SKELETON_CARD_KEYS.map((key) => (
        <li key={key} className={styles.skeleton} />
      ))}
    </ul>
  );
}
