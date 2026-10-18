import { z } from 'zod';

/** What the sync status route answers, and what the polling client parses. */
export const syncStatusSchema = z.object({
  /** `idle` means the user has never been synced. */
  state: z.enum(['idle', 'running', 'succeeded', 'failed']),
  startedAt: z.iso.datetime().nullable(),
  finishedAt: z.iso.datetime().nullable(),
});

export type SyncStatus = z.infer<typeof syncStatusSchema>;

export const IDLE_SYNC_STATUS: SyncStatus = { state: 'idle', startedAt: null, finishedAt: null };
