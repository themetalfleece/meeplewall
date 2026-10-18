import { and, asc, desc, eq, gte, inArray, isNull, lt, or, sql } from 'drizzle-orm';

import type { DatabaseExecutor } from '../database.ts';
import {
  bggUsers,
  collectionSyncs,
  type CollectionSync,
  type RefreshSource,
} from '../schema/index.ts';
import { ensureUser, findUser } from './users.ts';

// Repeats the partial unique index's predicate, so ON CONFLICT can infer that index.
const RUNNING = sql`${collectionSyncs.status} = 'running'`;

/** True when no worker holds the sync: never claimed, or its lease ran out. */
const UNLEASED = or(
  isNull(collectionSyncs.lockedUntil),
  lt(collectionSyncs.lockedUntil, sql`now()`),
);

export type CollectionSyncOutcome = { status: 'succeeded' } | { status: 'failed'; error: string };

/** A sync a worker has leased, with the BGG username to fetch. */
export interface ClaimedCollectionSync {
  sync: CollectionSync;
  username: string;
}

/**
 * Queues a sync of a user's collection, or joins the one already running, so
 * concurrent first visits share one sync. A running sync older than
 * `staleAfterSeconds` that no worker holds is treated as lost: it is marked
 * failed and a new one starts.
 */
export async function startCollectionSync(
  database: DatabaseExecutor,
  {
    username,
    source,
    staleAfterSeconds,
  }: { username: string; source: RefreshSource; staleAfterSeconds: number },
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
          UNLEASED,
          lt(collectionSyncs.startedAt, sql`now() - make_interval(secs => ${staleAfterSeconds})`),
        ),
      );

    const [created] = await transaction
      .insert(collectionSyncs)
      .values({ userId: user.id, source })
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

/**
 * Leases the oldest running sync no worker holds to `workerId` for
 * `holdSeconds`, or returns undefined when none is free. A sync whose leases
 * ran out `maxAttempts` times is failed instead, so one that crashes its worker
 * cannot keep crashing the next. `SKIP LOCKED` lets concurrent workers each take
 * a different sync.
 */
export async function claimNextCollectionSync(
  database: DatabaseExecutor,
  {
    workerId,
    holdSeconds,
    maxAttempts,
  }: { workerId: string; holdSeconds: number; maxAttempts: number },
): Promise<ClaimedCollectionSync | undefined> {
  await database
    .update(collectionSyncs)
    .set({
      status: 'failed',
      error: `Gave up after ${maxAttempts} attempts`,
      lockedBy: null,
      lockedUntil: null,
      finishedAt: sql`now()`,
    })
    .where(and(RUNNING, UNLEASED, gte(collectionSyncs.attempts, maxAttempts)));

  const nextSyncId = database
    .select({ id: collectionSyncs.id })
    .from(collectionSyncs)
    .where(and(RUNNING, UNLEASED, lt(collectionSyncs.attempts, maxAttempts)))
    .orderBy(asc(collectionSyncs.startedAt), asc(collectionSyncs.id))
    .limit(1)
    .for('update', { skipLocked: true });

  const [sync] = await database
    .update(collectionSyncs)
    .set({
      attempts: sql`${collectionSyncs.attempts} + 1`,
      lockedBy: workerId,
      lockedUntil: sql`now() + make_interval(secs => ${holdSeconds})`,
    })
    .where(inArray(collectionSyncs.id, nextSyncId))
    .returning();
  if (sync === undefined) {
    return undefined;
  }

  const [user] = await database
    .select({ username: bggUsers.bggUsername })
    .from(bggUsers)
    .where(eq(bggUsers.id, sync.userId));
  if (user === undefined) {
    throw new Error(`Sync ${sync.id} belongs to no user`);
  }

  return { sync, username: user.username };
}

/** Matches a sync only while this worker still holds its lease. */
function heldBy({ syncId, workerId }: { syncId: string; workerId: string }) {
  return and(eq(collectionSyncs.id, syncId), RUNNING, eq(collectionSyncs.lockedBy, workerId));
}

/**
 * Pushes a held lease `holdSeconds` into the future. Returns undefined when the
 * worker no longer holds the sync.
 */
export async function renewCollectionSyncLease(
  database: DatabaseExecutor,
  { syncId, workerId, holdSeconds }: { syncId: string; workerId: string; holdSeconds: number },
): Promise<CollectionSync | undefined> {
  const [sync] = await database
    .update(collectionSyncs)
    .set({ lockedUntil: sql`now() + make_interval(secs => ${holdSeconds})` })
    .where(heldBy({ syncId, workerId }))
    .returning();

  return sync;
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

/** The most recently started sync of a user's collection, or undefined when none ever ran. */
export async function getLatestCollectionSync(
  database: DatabaseExecutor,
  { username }: { username: string },
): Promise<CollectionSync | undefined> {
  const user = await findUser(database, { username });
  if (user === undefined) {
    return undefined;
  }

  const [sync] = await database
    .select()
    .from(collectionSyncs)
    .where(eq(collectionSyncs.userId, user.id))
    .orderBy(desc(collectionSyncs.startedAt), desc(collectionSyncs.id))
    .limit(1);

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
 * Records how a held sync ended and releases its lease. Returns undefined when
 * the worker no longer holds it, for example because the lease ran out and
 * another worker took over.
 */
export async function finishCollectionSync(
  database: DatabaseExecutor,
  {
    syncId,
    workerId,
    outcome,
  }: { syncId: string; workerId: string; outcome: CollectionSyncOutcome },
): Promise<CollectionSync | undefined> {
  const [sync] = await database
    .update(collectionSyncs)
    .set({
      status: outcome.status,
      error: errorOf(outcome),
      lockedBy: null,
      lockedUntil: null,
      finishedAt: sql`now()`,
    })
    .where(heldBy({ syncId, workerId }))
    .returning();

  return sync;
}
