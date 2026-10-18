import { GridSkeleton } from '@/components/CollectionGrid';

import styles from './CollectionSection.module.css';

/** The shell's stand-in for the collection until the request-time read streams in. */
export function CollectionSectionSkeleton() {
  return (
    <>
      <div className={styles.titleSkeleton} aria-hidden="true" />
      <GridSkeleton />
    </>
  );
}
