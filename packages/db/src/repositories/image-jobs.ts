import { and, asc, eq, inArray, lt, or, sql } from 'drizzle-orm';

import type { DatabaseExecutor } from '../database.ts';
import {
  imageAssets,
  imageJobs,
  type ImageAsset,
  type ImageJob,
  type ImageKind,
} from '../schema/index.ts';
import { leaseExpiry } from './leases.ts';

export type ImageAssetInput = Pick<
  ImageAsset,
  'storageKey' | 'contentType' | 'width' | 'height' | 'byteSize' | 'sideColor' | 'edgeColor'
>;

// Repeats the partial unique index's predicate, so ON CONFLICT can infer that index.
const OPEN_JOB = sql`${imageJobs.status} in ('pending', 'processing')`;

/** Queues an image job, or returns undefined when one is already open for that image. */
export async function enqueueImageJob(
  database: DatabaseExecutor,
  { bggGameId, kind }: { bggGameId: number; kind: ImageKind },
): Promise<ImageJob | undefined> {
  const [job] = await database
    .insert(imageJobs)
    .values({ bggGameId, kind })
    .onConflictDoNothing({ target: [imageJobs.bggGameId, imageJobs.kind], where: OPEN_JOB })
    .returning();

  return job;
}

/**
 * Leases the oldest claimable job to a worker for `holdSeconds`, or returns
 * undefined when none is free. A job is claimable when pending, or when a
 * previous worker's lease ran out. `SKIP LOCKED` lets concurrent workers each
 * take a different job instead of queueing on the same row.
 */
export async function claimNextImageJob(
  database: DatabaseExecutor,
  { workerId, holdSeconds }: { workerId: string; holdSeconds: number },
): Promise<ImageJob | undefined> {
  const nextJobId = database
    .select({ id: imageJobs.id })
    .from(imageJobs)
    .where(
      or(
        eq(imageJobs.status, 'pending'),
        and(eq(imageJobs.status, 'processing'), lt(imageJobs.lockedUntil, sql`now()`)),
      ),
    )
    .orderBy(asc(imageJobs.createdAt), asc(imageJobs.id))
    .limit(1)
    .for('update', { skipLocked: true });

  const [job] = await database
    .update(imageJobs)
    .set({
      status: 'processing',
      attempts: sql`${imageJobs.attempts} + 1`,
      lockedBy: workerId,
      lockedUntil: leaseExpiry(holdSeconds),
      updatedAt: sql`now()`,
    })
    .where(inArray(imageJobs.id, nextJobId))
    .returning();

  return job;
}

/** Matches a job only while this worker still holds its lease. */
function heldBy({ jobId, workerId }: { jobId: number; workerId: string }) {
  return and(
    eq(imageJobs.id, jobId),
    eq(imageJobs.status, 'processing'),
    eq(imageJobs.lockedBy, workerId),
  );
}

/**
 * Completes a job and stores its asset, replacing any earlier asset for the same
 * game and kind. Returns undefined when the worker no longer holds the job.
 */
export async function markImageJobReady(
  database: DatabaseExecutor,
  { jobId, workerId, asset }: { jobId: number; workerId: string; asset: ImageAssetInput },
): Promise<{ job: ImageJob; asset: ImageAsset } | undefined> {
  return database.transaction(async (transaction) => {
    const [job] = await transaction
      .update(imageJobs)
      .set({
        status: 'ready',
        lastError: null,
        lockedBy: null,
        lockedUntil: null,
        updatedAt: sql`now()`,
      })
      .where(heldBy({ jobId, workerId }))
      .returning();
    if (job === undefined) {
      return undefined;
    }

    const [savedAsset] = await transaction
      .insert(imageAssets)
      .values({ ...asset, bggGameId: job.bggGameId, kind: job.kind })
      .onConflictDoUpdate({ target: [imageAssets.bggGameId, imageAssets.kind], set: asset })
      .returning();
    if (savedAsset === undefined) {
      throw new Error(`Saving the asset for image job ${jobId} returned no row`);
    }

    return { job, asset: savedAsset };
  });
}

/** Fails a job for good. Returns undefined when the worker no longer holds the job. */
export async function markImageJobFailed(
  database: DatabaseExecutor,
  { jobId, workerId, error }: { jobId: number; workerId: string; error: string },
): Promise<ImageJob | undefined> {
  const [job] = await database
    .update(imageJobs)
    .set({
      status: 'failed',
      lastError: error,
      lockedBy: null,
      lockedUntil: null,
      updatedAt: sql`now()`,
    })
    .where(heldBy({ jobId, workerId }))
    .returning();

  return job;
}
