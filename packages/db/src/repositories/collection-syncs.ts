import { and, eq, lt, sql } from 'drizzle-orm';

import type { DatabaseExecutor } from '../database.ts';
import { collectionSyncs, type CollectionSync } from '../schema/index.ts';
import { ensureUser } from './users.ts';

// Repeats the partial unique index's predicate, so ON CONFLICT can infer that index.
const RUNNING = sql`${collectionSyncs.status} = 'running'`;

export type CollectionSyncOutcome = { status: 'succeeded' } | { status: 'failed'; error: string };

/**
 * Starts a sync of a user's collection, or joins the one already running, so
 * concurrent first visits share one sync. A running sync older than
 * `staleAfterSeconds` is treated as abandoned by a crashed process: it is marked
 * failed and a new one starts.
 */
export async function startCollectionSync(
  database: DatabaseExecutor,
  { username, staleAfterSeconds }: { username: string; staleAfterSeconds: number },
): Promise<{ sync: CollectionSync; started: boolean }> {
  return database.transaction(async (transaction) => {
    const user = await ensureUser(transaction, { username });

    await transaction
      .update(collectionSyncs)
      .set({ status: 'failed', error: 'Abandoned while running', finishedAt: sql`now()` })
      .where(
        and(
          eq(collectionSyncs.userId, user.id),
          RUNNING,
          lt(collectionSyncs.startedAt, sql`now() - make_interval(secs => ${staleAfterSeconds})`),
        ),
      );

    const [created] = await transaction
      .insert(collectionSyncs)
      .values({ userId: user.id })
      .onConflictDoNothing({ target: collectionSyncs.userId, where: RUNNING })
      .returning();
    if (created !== undefined) {
      return { sync: created, started: true };
    }

    const [running] = await transaction
      .select()
      .from(collectionSyncs)
      .where(and(eq(collectionSyncs.userId, user.id), RUNNING));
    if (running === undefined) {
      throw new Error(`No running sync for "${username}" after a conflicting insert`);
    }

    return { sync: running, started: false };
  });
}

export async function getCollectionSync(
  database: DatabaseExecutor,
  { syncId }: { syncId: string },
): Promise<CollectionSync | undefined> {
  const [sync] = await database
    .select()
    .from(collectionSyncs)
    .where(eq(collectionSyncs.id, syncId));

  return sync;
}

function errorOf(outcome: CollectionSyncOutcome): string | null {
  if (outcome.status === 'succeeded') {
    return null;
  }
  if (outcome.status === 'failed') {
    return outcome.error;
  }
  const unhandled: never = outcome;
  throw new Error(`Unhandled sync outcome ${JSON.stringify(unhandled)}`);
}

/**
 * Records how a running sync ended. Returns undefined when the sync is not
 * running, for example because it was already finished or marked abandoned.
 */
export async function finishCollectionSync(
  database: DatabaseExecutor,
  { syncId, outcome }: { syncId: string; outcome: CollectionSyncOutcome },
): Promise<CollectionSync | undefined> {
  const [sync] = await database
    .update(collectionSyncs)
    .set({ status: outcome.status, error: errorOf(outcome), finishedAt: sql`now()` })
    .where(and(eq(collectionSyncs.id, syncId), RUNNING))
    .returning();

  return sync;
}
