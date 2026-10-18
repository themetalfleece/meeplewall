import { readFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';

import {
  enqueueImageJob,
  imageAssets,
  imageJobs,
  upsertGame,
  type ImageKind,
} from '@meeplewall/db';
import { eq } from 'drizzle-orm';
import sharp from 'sharp';
import { JsonLogger } from '@meeplewall/worker-runtime';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { createRevalidate } from './revalidate.ts';
import { StubServer, type StubResponse } from './testing/stub-server.ts';
import { resolveTestServices, TestServices } from './testing/test-services.ts';
import { ImageWorker } from './worker.ts';

// Runs the worker against the compose Postgres and minio, with a local stub serving the source
// cover and standing in for apps/web's revalidate route.

const config = await resolveTestServices();

const BGG_GAME_ID = 362976;
const SOURCE_PATH = '/images/beacon-patrol.jpg';
const REVALIDATE_PATH = '/api/internal/revalidate';
const SECRET = 'test-secret-that-is-at-least-32-characters';
const WORKER_ID = 'worker-under-test';

const sourceCover = await readFile(new URL('fixtures/beacon-patrol-362976.jpg', import.meta.url));

describe.skipIf(config === undefined)('ImageWorker against Postgres and minio', () => {
  let services: TestServices;
  let stub: StubServer;
  const logLines: string[] = [];
  const uploadedKeys: string[] = [];

  function createWorker({ idleMilliseconds = 20 }: { idleMilliseconds?: number } = {}) {
    return new ImageWorker({
      database: services.database,
      storage: services.storage,
      revalidate: createRevalidate({ webInternalUrl: stub.baseUrl, secret: SECRET }),
      logger: new JsonLogger({ write: (line) => logLines.push(line) }),
      workerId: WORKER_ID,
      holdSeconds: 60,
      idleMilliseconds,
      sourceTimeoutMilliseconds: 5_000,
      maxSourceBytes: 32 * 1024 * 1024,
    });
  }

  async function addGame({ imageUrlRaw }: { imageUrlRaw: string | null }) {
    await upsertGame(services.database, {
      game: { id: BGG_GAME_ID, name: 'Beacon Patrol', imageUrlRaw },
    });
  }

  async function enqueue(kind: ImageKind) {
    const job = await enqueueImageJob(services.database, { bggGameId: BGG_GAME_ID, kind });
    if (job === undefined) {
      throw new Error(`Enqueueing the ${kind} job returned no row`);
    }
    return job;
  }

  async function readJob(jobId: number) {
    const [job] = await services.database.select().from(imageJobs).where(eq(imageJobs.id, jobId));
    return job;
  }

  async function readAsset(kind: ImageKind) {
    const assets = await services.database
      .select()
      .from(imageAssets)
      .where(eq(imageAssets.bggGameId, BGG_GAME_ID));
    const asset = assets.find((candidate) => candidate.kind === kind);
    if (asset !== undefined) {
      uploadedKeys.push(asset.storageKey);
    }
    return asset;
  }

  function serveSourceCover(options: { waitFor?: Promise<void> } = {}) {
    stub.route({
      path: SOURCE_PATH,
      response: { status: 200, body: sourceCover, contentType: 'image/jpeg', ...options },
    });
  }

  beforeAll(async () => {
    if (config === undefined) {
      throw new Error('The suite ran without services; it should have been skipped');
    }
    services = await TestServices.create(config);
    stub = await StubServer.start();
  });

  beforeEach(async () => {
    await services.reset();
    stub.reset();
    stub.route({ path: REVALIDATE_PATH, response: { status: 204 } });
    logLines.length = 0;
  });

  afterEach(async () => {
    await Promise.all(uploadedKeys.map((key) => services.storage.deleteObject({ key })));
    uploadedKeys.length = 0;
  });

  afterAll(async () => {
    await stub.close();
    await services.destroy();
  });

  it('uploads both sizes, marks the jobs ready and revalidates the game', async () => {
    await addGame({ imageUrlRaw: stub.url(SOURCE_PATH) });
    serveSourceCover();
    const coverJob = await enqueue('cover');
    const thumbJob = await enqueue('thumb');
    const worker = createWorker();

    expect(await worker.processNextJob()).toEqual({ jobId: coverJob.id, status: 'ready' });
    expect(await worker.processNextJob()).toEqual({ jobId: thumbJob.id, status: 'ready' });
    expect(await worker.processNextJob()).toBeUndefined();

    for (const [kind, jobId, longSide] of [
      ['cover', coverJob.id, 1024],
      ['thumb', thumbJob.id, 320],
    ] satisfies [ImageKind, number, number][]) {
      expect(await readJob(jobId)).toMatchObject({
        status: 'ready',
        lastError: null,
        lockedBy: null,
      });

      const asset = await readAsset(kind);
      expect(asset).toMatchObject({ contentType: 'image/webp', height: longSide });
      expect(asset?.sideColor).toMatch(/^#[0-9a-f]{6}$/);
      expect(asset?.storageKey).toMatch(new RegExp(`^covers/${BGG_GAME_ID}\\.[0-9a-f]{16}`));

      const response = await fetch(services.storage.getPublicUrl({ key: asset?.storageKey ?? '' }));
      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toBe('image/webp');
      expect(response.headers.get('cache-control')).toBe('public, max-age=31536000, immutable');
      const body = Buffer.from(await response.arrayBuffer());
      expect(body.byteLength).toBe(asset?.byteSize);
      expect(await sharp(body).metadata()).toMatchObject({
        format: 'webp',
        width: asset?.width,
        height: longSide,
      });
    }

    const revalidations = stub.requestsTo(REVALIDATE_PATH);
    expect(revalidations).toHaveLength(2);
    for (const request of revalidations) {
      expect(request.method).toBe('POST');
      expect(request.headers.authorization).toBe(`Bearer ${SECRET}`);
      expect(JSON.parse(request.body)).toEqual({ bggGameId: BGG_GAME_ID });
    }
  });

  it('fails a job whose source 404s, with the status in last_error', async () => {
    await addGame({ imageUrlRaw: stub.url('/images/missing.jpg') });
    const job = await enqueue('cover');

    expect(await createWorker().processNextJob()).toEqual({ jobId: job.id, status: 'failed' });

    expect(await readJob(job.id)).toMatchObject({
      status: 'failed',
      lastError: 'Source fetch failed with 404',
      lockedBy: null,
    });
    expect(await readAsset('cover')).toBeUndefined();
    expect(stub.requestsTo(REVALIDATE_PATH)).toHaveLength(0);
  });

  it('fails a job whose source is not an image', async () => {
    await addGame({ imageUrlRaw: stub.url(SOURCE_PATH) });
    stub.route({
      path: SOURCE_PATH,
      response: { status: 200, body: '<html>Blocked</html>', contentType: 'text/html' },
    });
    const job = await enqueue('cover');

    expect(await createWorker().processNextJob()).toEqual({ jobId: job.id, status: 'failed' });

    const failed = await readJob(job.id);
    expect(failed?.status).toBe('failed');
    expect(failed?.lastError).toMatch(/unsupported image format/i);
  });

  it('fails a job whose game has no source image', async () => {
    await addGame({ imageUrlRaw: null });
    const job = await enqueue('thumb');

    expect(await createWorker().processNextJob()).toEqual({ jobId: job.id, status: 'failed' });

    expect(await readJob(job.id)).toMatchObject({
      status: 'failed',
      lastError: `Game ${BGG_GAME_ID} has no source image`,
    });
  });

  it('keeps the job ready when revalidating fails', async () => {
    await addGame({ imageUrlRaw: stub.url(SOURCE_PATH) });
    serveSourceCover();
    stub.route({ path: REVALIDATE_PATH, response: { status: 500 } });
    const job = await enqueue('thumb');

    expect(await createWorker().processNextJob()).toEqual({ jobId: job.id, status: 'ready' });

    expect((await readJob(job.id))?.status).toBe('ready');
    expect(await readAsset('thumb')).toBeDefined();
    expect(logLines.some((line) => line.includes('Revalidate failed with 500'))).toBe(true);
  });

  describe('when another worker takes the lease mid-job', () => {
    /** Holds the source response until the lease has moved to another worker, then lets it through. */
    async function processWhileLeaseIsTaken(response: Omit<StubResponse, 'waitFor'>) {
      await addGame({ imageUrlRaw: stub.url(SOURCE_PATH) });
      let releaseSource = () => {};
      const sourceReleased = new Promise<void>((resolve) => {
        releaseSource = resolve;
      });
      stub.route({ path: SOURCE_PATH, response: { ...response, waitFor: sourceReleased } });
      const job = await enqueue('cover');

      const processing = createWorker().processNextJob();
      await expect.poll(() => stub.requestsTo(SOURCE_PATH).length).toBe(1);
      await services.database
        .update(imageJobs)
        .set({ lockedBy: 'another-worker' })
        .where(eq(imageJobs.id, job.id));
      releaseSource();

      return { job, outcome: await processing };
    }

    it('neither records the asset nor revalidates', async () => {
      const { job, outcome } = await processWhileLeaseIsTaken({
        status: 200,
        body: sourceCover,
        contentType: 'image/jpeg',
      });

      expect(outcome).toEqual({ jobId: job.id, status: 'lost' });
      expect(await readJob(job.id)).toMatchObject({
        status: 'processing',
        lockedBy: 'another-worker',
      });
      expect(await readAsset('cover')).toBeUndefined();
      expect(stub.requestsTo(REVALIDATE_PATH)).toHaveLength(0);
    });

    it('does not mark the job failed over the new holder', async () => {
      const { job, outcome } = await processWhileLeaseIsTaken({ status: 404 });

      expect(outcome).toEqual({ jobId: job.id, status: 'lost' });
      expect(await readJob(job.id)).toMatchObject({
        status: 'processing',
        lockedBy: 'another-worker',
        lastError: null,
      });
    });
  });

  it('finishes the job in hand when stopped, then returns', async () => {
    await addGame({ imageUrlRaw: stub.url(SOURCE_PATH) });
    let releaseSource = () => {};
    const sourceReleased = new Promise<void>((resolve) => {
      releaseSource = resolve;
    });
    serveSourceCover({ waitFor: sourceReleased });
    const inFlight = await enqueue('cover');
    const worker = createWorker();

    const running = worker.run();
    await expect.poll(() => stub.requestsTo(SOURCE_PATH).length).toBe(1);
    worker.stop();
    const queuedAfterStop = await enqueue('thumb');
    releaseSource();
    await running;

    expect((await readJob(inFlight.id))?.status).toBe('ready');
    expect((await readJob(queuedAfterStop.id))?.status).toBe('pending');
    expect(await readAsset('cover')).toBeDefined();
  });

  it('returns promptly when stopped while idle', async () => {
    // Far longer than the test timeout, so only an interrupted wait lets it pass.
    const worker = createWorker({ idleMilliseconds: 600_000 });

    const running = worker.run();
    // Long enough for the empty poll to finish, so the worker is asleep when it is stopped.
    await delay(200);
    worker.stop();

    await expect(running).resolves.toBeUndefined();
  });
});
