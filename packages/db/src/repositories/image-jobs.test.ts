import { eq, sql } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import { SEED_GAMES } from '../dev/seed-data.ts';
import { resolveTestServerUrl, useTestDatabase } from '../dev/test-database.ts';
import { imageAssets, imageJobs, type ImageKind } from '../schema/index.ts';
import { upsertGame } from './games.ts';
import {
  claimNextImageJob,
  enqueueImageJob,
  markImageJobFailed,
  markImageJobReady,
  type ImageAssetInput,
} from './image-jobs.ts';

const serverUrl = await resolveTestServerUrl();

const [GAME] = SEED_GAMES;
if (GAME === undefined) {
  throw new Error('The seed data has no games');
}

const ASSET: ImageAssetInput = {
  storageKey: `covers/${GAME.id}.webp`,
  contentType: 'image/webp',
  width: 1024,
  height: 768,
  byteSize: 54_321,
  sideColor: '#aa3322',
  edgeColor: null,
};

/** A one-shot promise that another async task can wait on. */
class Signal {
  readonly fired: Promise<void>;
  #resolve: () => void = () => {};

  constructor() {
    this.fired = new Promise((resolve) => {
      this.#resolve = resolve;
    });
  }

  fire(): void {
    this.#resolve();
  }
}

describe.skipIf(serverUrl === undefined)('image jobs', () => {
  const database = useTestDatabase(serverUrl);

  const enqueue = async (kind: ImageKind) => {
    await upsertGame(database(), { game: GAME });
    const job = await enqueueImageJob(database(), { bggGameId: GAME.id, kind });
    if (job === undefined) {
      throw new Error(`Enqueueing a ${kind} job returned nothing`);
    }
    return job;
  };

  const claim = async (workerId: string) => {
    const job = await claimNextImageJob(database(), { workerId, holdSeconds: 60 });
    if (job === undefined) {
      throw new Error(`${workerId} claimed nothing`);
    }
    return job;
  };

  describe('enqueueImageJob', () => {
    it('queues a pending job', async () => {
      const job = await enqueue('cover');

      expect(job).toMatchObject({ status: 'pending', attempts: 0, lockedBy: null });
    });

    it('returns undefined while a job for the same image is open', async () => {
      await enqueue('cover');

      expect(
        await enqueueImageJob(database(), { bggGameId: GAME.id, kind: 'cover' }),
      ).toBeUndefined();
      expect(
        await enqueueImageJob(database(), { bggGameId: GAME.id, kind: 'thumb' }),
      ).toBeDefined();
    });

    it('queues a new job once the previous one is finished', async () => {
      const first = await enqueue('cover');
      await claim('worker-a');
      await markImageJobFailed(database(), { jobId: first.id, workerId: 'worker-a', error: 'x' });

      const second = await enqueueImageJob(database(), { bggGameId: GAME.id, kind: 'cover' });

      expect(second?.id).not.toBe(first.id);
    });
  });

  describe('claimNextImageJob', () => {
    it('returns undefined when the queue is empty', async () => {
      expect(
        await claimNextImageJob(database(), { workerId: 'worker-a', holdSeconds: 60 }),
      ).toBeUndefined();
    });

    it('leases the oldest pending job to the worker', async () => {
      const oldest = await enqueue('cover');
      await enqueue('thumb');

      const claimed = await claim('worker-a');

      expect(claimed).toMatchObject({
        id: oldest.id,
        status: 'processing',
        attempts: 1,
        lockedBy: 'worker-a',
      });
      expect(claimed.lockedUntil?.getTime()).toBeGreaterThan(Date.now());
    });

    it('never hands a leased job to a second worker', async () => {
      await enqueue('cover');
      await claim('worker-a');

      expect(
        await claimNextImageJob(database(), { workerId: 'worker-b', holdSeconds: 60 }),
      ).toBeUndefined();
    });

    it('reclaims a job whose lease ran out', async () => {
      const job = await enqueue('cover');
      await claim('worker-a');
      await database()
        .update(imageJobs)
        .set({ lockedUntil: sql`now() - interval '1 second'` })
        .where(eq(imageJobs.id, job.id));

      const reclaimed = await claim('worker-b');

      expect(reclaimed).toMatchObject({ id: job.id, lockedBy: 'worker-b', attempts: 2 });
    });

    it('skips a job another claimer has locked instead of waiting for it', async () => {
      const first = await enqueue('cover');
      const second = await enqueue('thumb');
      const firstClaimed = new Signal();
      const firstClaimerMayCommit = new Signal();

      // The first claimer holds its row lock until the second claimer is done.
      // Without SKIP LOCKED the second blocks on that lock and this test times out.
      const firstClaim = database().transaction(async (transaction) => {
        const job = await claimNextImageJob(transaction, { workerId: 'worker-a', holdSeconds: 60 });
        firstClaimed.fire();
        await firstClaimerMayCommit.fired;
        return job;
      });
      await firstClaimed.fired;
      const secondClaim = await claimNextImageJob(database(), {
        workerId: 'worker-b',
        holdSeconds: 60,
      });
      firstClaimerMayCommit.fire();

      expect((await firstClaim)?.id).toBe(first.id);
      expect(secondClaim?.id).toBe(second.id);
    });

    it('gives concurrent claimers different jobs', async () => {
      await enqueue('cover');
      await enqueue('thumb');

      const claims = await Promise.all(
        ['worker-a', 'worker-b', 'worker-c'].map((workerId) =>
          claimNextImageJob(database(), { workerId, holdSeconds: 60 }),
        ),
      );

      const claimedIds = claims.flatMap((job) => (job === undefined ? [] : [job.id]));
      expect(claimedIds).toHaveLength(2);
      expect(new Set(claimedIds).size).toBe(2);
    });
  });

  describe('markImageJobReady', () => {
    it('completes the job and stores its asset', async () => {
      const job = await enqueue('cover');
      await claim('worker-a');

      const result = await markImageJobReady(database(), {
        jobId: job.id,
        workerId: 'worker-a',
        asset: ASSET,
      });

      expect(result?.job).toMatchObject({ status: 'ready', lockedBy: null, lockedUntil: null });
      expect(result?.asset).toMatchObject({ ...ASSET, bggGameId: GAME.id, kind: 'cover' });
    });

    it('replaces an earlier asset for the same game and kind', async () => {
      const first = await enqueue('cover');
      await claim('worker-a');
      await markImageJobReady(database(), { jobId: first.id, workerId: 'worker-a', asset: ASSET });
      const second = await enqueue('cover');
      await claim('worker-a');

      await markImageJobReady(database(), {
        jobId: second.id,
        workerId: 'worker-a',
        asset: { ...ASSET, width: 512, sideColor: null },
      });

      const assets = await database().select().from(imageAssets);
      expect(assets).toHaveLength(1);
      expect(assets[0]).toMatchObject({ width: 512, sideColor: null });
    });

    it('refuses a worker that does not hold the job, storing no asset', async () => {
      const job = await enqueue('cover');
      await claim('worker-a');

      const result = await markImageJobReady(database(), {
        jobId: job.id,
        workerId: 'worker-b',
        asset: ASSET,
      });

      expect(result).toBeUndefined();
      expect(await database().select().from(imageAssets)).toEqual([]);
    });
  });

  describe('markImageJobFailed', () => {
    it('fails the job with the error and releases the lease', async () => {
      const job = await enqueue('cover');
      await claim('worker-a');

      const failed = await markImageJobFailed(database(), {
        jobId: job.id,
        workerId: 'worker-a',
        error: 'BGG returned 404',
      });

      expect(failed).toMatchObject({
        status: 'failed',
        lastError: 'BGG returned 404',
        lockedBy: null,
      });
      expect(
        await claimNextImageJob(database(), { workerId: 'worker-a', holdSeconds: 60 }),
      ).toBeUndefined();
    });

    it('refuses a job that is not being processed', async () => {
      const job = await enqueue('cover');

      expect(
        await markImageJobFailed(database(), { jobId: job.id, workerId: 'worker-a', error: 'x' }),
      ).toBeUndefined();
    });
  });
});
