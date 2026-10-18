import styles from './GameBoxViewer.module.css';

/** Holds the canvas's space while the renderer's chunk loads. */
export function BoxPlaceholder() {
  return <div className={styles.placeholder} />;
}
