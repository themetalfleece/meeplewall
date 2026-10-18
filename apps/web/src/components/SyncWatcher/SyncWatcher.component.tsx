'use client';

import { describeSync } from './SyncWatcher.data';
import { useRefreshCollection, useSyncStatus } from './SyncWatcher.hooks';
import styles from './SyncWatcher.module.css';
import type { SyncWatcherProps } from './SyncWatcher.types';

/** The collection's freshness line, with a refresh button and live progress while a sync runs. */
export function SyncWatcher({ username, initialStatus, fetchedAt }: SyncWatcherProps) {
  const status = useSyncStatus({ username, initialStatus });
  const refresh = useRefreshCollection({ username });
  const isRunning = status.state === 'running';
  const throttled = refresh.data?.kind === 'throttled' ? refresh.data : null;

  function handleRefreshClick() {
    refresh.mutate();
  }

  return (
    <div className={styles.bar} role="status" aria-live="polite">
      {isRunning && <span className={styles.spinner} aria-hidden="true" />}
      <p className={styles.message}>{describeSync({ status, fetchedAt })}</p>
      {throttled !== null && (
        <p className={styles.hint}>Try again in {throttled.retryAfterSeconds} seconds.</p>
      )}
      {refresh.isError && <p className={styles.hint}>The refresh request failed.</p>}
      {!isRunning && (
        <button
          className={styles.button}
          type="button"
          onClick={handleRefreshClick}
          disabled={refresh.isPending}
        >
          {status.state === 'failed' ? 'Try again' : 'Refresh from BGG'}
        </button>
      )}
    </div>
  );
}
