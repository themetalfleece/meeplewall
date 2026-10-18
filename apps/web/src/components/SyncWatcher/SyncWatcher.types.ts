import type { SyncStatus } from '@/lib/sync-status';

export interface SyncWatcherProps {
  username: string;
  initialStatus: SyncStatus;
  /** When the stored collection was fetched, or null before the first sync. */
  fetchedAt: string | null;
}

/** What a manual refresh request came back with. */
export type RefreshResult =
  | { kind: 'accepted'; status: SyncStatus }
  | { kind: 'throttled'; status: SyncStatus; retryAfterSeconds: number };
