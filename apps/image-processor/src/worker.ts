import { createHash } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';

import {
  claimNextImageJob,
  getGame,
  markImageJobFailed,
  markImageJobReady,
  type DatabaseExecutor,
  type ImageJob,
  type ImageKind,
} from '@meeplewall/db';
import { processCover, type EncodedImage } from '@meeplewall/image-pipeline';
import type { Storage } from '@meeplewall/storage';

import { downloadSource } from './download-source.ts';
import { describeError, type JsonLogger } from './logger.ts';
import type { Revalidate } from './revalidate.ts';

/** What happened to a claimed job. `lost` means another worker took over its lease. */
export interface JobOutcome {
  jobId: number;
  status: 'ready' | 'failed' | 'lost';
}

export interface ImageWorkerOptions {
  database: DatabaseExecutor;
  storage: Storage;
  revalidate: Revalidate;
  logger: JsonLogger;
  workerId: string;
  /** How long a claimed job stays leased to this worker. */
  holdSeconds: number;
  /** How long to wait before polling again when the queue is empty. */
  idleMilliseconds: number;
  /** How long downloading a source image may take. Keep it well inside `holdSeconds`. */
  sourceTimeoutMilliseconds: number;
  /** The largest source image it will download. */
  maxSourceBytes: number;
}

// Keys are content-addressed, so a year-long immutable cache can never serve an outdated image.
const CACHE_CONTROL = 'public, max-age=31536000, immutable';
const KEY_SUFFIX: Record<ImageKind, string> = { cover: '', thumb: '.thumb' };

/** The storage key for one processed image, with a digest of its bytes. */
export function imageStorageKey({
  bggGameId,
  kind,
  data,
}: {
  bggGameId: number;
  kind: ImageKind;
  data: Uint8Array;
}): string {
  const digest = createHash('sha256').update(data).digest('hex').slice(0, 16);

  return `covers/${bggGameId}.${digest}${KEY_SUFFIX[kind]}.webp`;
}

/**
 * Drains `image_jobs`: claims a job, downloads the game's cover, renders the
 * claimed size, uploads it and records the asset, then asks apps/web to
 * re-render the game's pages. A failed job is marked failed with its reason.
 */
export class ImageWorker {
  readonly #options: ImageWorkerOptions;
  readonly #stopping = new AbortController();

  constructor(options: ImageWorkerOptions) {
    this.#options = options;
  }

  get isStopping(): boolean {
    return this.#stopping.signal.aborted;
  }

  /** Asks `run` to return once the job in hand, if any, is finished. */
  stop(): void {
    this.#stopping.abort();
  }

  /** Processes jobs until `stop` is called. Never rejects: a failed poll is logged and retried. */
  async run(): Promise<void> {
    while (!this.isStopping) {
      const outcome = await this.#pollOnce();
      if (outcome === undefined) {
        await this.#idle();
      }
    }
  }

  /** Claims and processes one job. Resolves undefined when the queue has nothing claimable. */
  async processNextJob(): Promise<JobOutcome | undefined> {
    const { database, workerId, holdSeconds, logger } = this.#options;
    const job = await claimNextImageJob(database, { workerId, holdSeconds });
    if (job === undefined) {
      return undefined;
    }
    logger.info('Claimed image job', jobFields(job));

    try {
      return await this.#complete(job);
    } catch (error) {
      return this.#fail({ job, error });
    }
  }

  async #pollOnce(): Promise<JobOutcome | undefined> {
    try {
      return await this.processNextJob();
    } catch (error) {
      this.#options.logger.error('Polling for image jobs failed', { error: describeError(error) });
      return undefined;
    }
  }

  async #idle(): Promise<void> {
    try {
      await delay(this.#options.idleMilliseconds, undefined, { signal: this.#stopping.signal });
    } catch (error) {
      if (!this.isStopping) {
        throw error;
      }
    }
  }

  async #render(
    job: ImageJob,
  ): Promise<{ image: EncodedImage; sideColor: string; edgeColor: string }> {
    const game = await getGame(this.#options.database, { bggId: job.bggGameId });
    const sourceUrl = game?.imageUrlRaw;
    if (sourceUrl === undefined || sourceUrl === null || sourceUrl === '') {
      throw new Error(`Game ${job.bggGameId} has no source image`);
    }

    const input = await downloadSource({
      sourceUrl,
      timeoutMilliseconds: this.#options.sourceTimeoutMilliseconds,
      maxBytes: this.#options.maxSourceBytes,
    });
    const processed = await processCover({ input });

    return {
      image: processed[job.kind],
      sideColor: processed.sideColor,
      edgeColor: processed.edgeColor,
    };
  }

  async #complete(job: ImageJob): Promise<JobOutcome> {
    const { database, storage, workerId, logger } = this.#options;
    const { image, sideColor, edgeColor } = await this.#render(job);
    const storageKey = imageStorageKey({
      bggGameId: job.bggGameId,
      kind: job.kind,
      data: image.data,
    });
    await storage.putObject({
      key: storageKey,
      body: image.data,
      contentType: image.contentType,
      cacheControl: CACHE_CONTROL,
    });

    const saved = await markImageJobReady(database, {
      jobId: job.id,
      workerId,
      asset: {
        storageKey,
        contentType: image.contentType,
        width: image.width,
        height: image.height,
        byteSize: image.data.byteLength,
        sideColor,
        edgeColor,
      },
    });
    if (saved === undefined) {
      logger.warn('Lost the lease before the image job finished', jobFields(job));
      return { jobId: job.id, status: 'lost' };
    }
    logger.info('Image job ready', { ...jobFields(job), storageKey });

    await this.#revalidate(job);
    return { jobId: job.id, status: 'ready' };
  }

  /** The asset is already stored, so a web that cannot be reached only delays the re-render. */
  async #revalidate(job: ImageJob): Promise<void> {
    try {
      await this.#options.revalidate({ bggGameId: job.bggGameId });
    } catch (error) {
      this.#options.logger.warn('Revalidating the game pages failed', {
        ...jobFields(job),
        error: describeError(error),
      });
    }
  }

  async #fail({ job, error }: { job: ImageJob; error: unknown }): Promise<JobOutcome> {
    const { database, workerId, logger } = this.#options;
    const reason = describeError(error);
    const failed = await markImageJobFailed(database, { jobId: job.id, workerId, error: reason });
    if (failed === undefined) {
      logger.warn('Lost the lease before the image job failed', {
        ...jobFields(job),
        error: reason,
      });
      return { jobId: job.id, status: 'lost' };
    }
    logger.error('Image job failed', { ...jobFields(job), error: reason });

    return { jobId: job.id, status: 'failed' };
  }
}

function jobFields(job: ImageJob) {
  return { jobId: job.id, bggGameId: job.bggGameId, kind: job.kind, attempt: job.attempts };
}
