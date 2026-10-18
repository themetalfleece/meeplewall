import styles from './CollectionNavSkeleton.module.css';

export function CollectionNavSkeleton() {
  return <div className={styles.skeleton} aria-hidden="true" />;
}
