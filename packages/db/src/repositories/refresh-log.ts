import type { DatabaseExecutor } from '../database.ts';
import { refreshLog, type NewRefreshLogEntry, type RefreshLogEntry } from '../schema/index.ts';

export type RefreshLogInput = Pick<
  NewRefreshLogEntry,
  'userId' | 'source' | 'status' | 'durationMs'
>;

/** Records one finished refresh of a user's collection. */
export async function recordRefresh(
  database: DatabaseExecutor,
  { entry }: { entry: RefreshLogInput },
): Promise<RefreshLogEntry> {
  const [saved] = await database.insert(refreshLog).values(entry).returning();
  if (saved === undefined) {
    throw new Error(`Recording a refresh for user ${entry.userId} returned no row`);
  }

  return saved;
}
