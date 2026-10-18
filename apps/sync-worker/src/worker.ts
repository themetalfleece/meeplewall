import type { CollectionSyncService, SyncRunOutcome } from '@meeplewall/collection-sync';
import {
  claimNextCollectionSync,
  renewCollectionSyncLease,
  type ClaimedCollectionSync,
  type DatabaseExecutor,
} from '@meeplewall/db';
import { describeError, PollLoop, type JsonLogger } from '@meeplewall/worker-runtime';

/** How the worker takes and keeps hold of syncs. */
export interface SyncLeases {
  /** Leases the next waiting sync, or resolves undefined when none is free. */
  claim(): Promise<ClaimedCollectionSync | undefined>;
  /** Extends a held lease. Resolves false once the worker no longer holds it. */
  renew(syncId: string): Promise<boolean>;
}

/** Leases backed by `collection_syncs`. */
export function databaseLeases({
  database,
  workerId,
  holdSeconds,
  maxAttempts,
}: {
  database: DatabaseExecutor;
  workerId: string;
  holdSeconds: number;
  maxAttempts: number;
}): SyncLeases {
  return {
    claim: () => claimNextCollectionSync(database, { workerId, holdSeconds, maxAttempts }),
    renew: async (syncId) =>
      (await renewCollectionSyncLease(database, { syncId, workerId, holdSeconds })) !== undefined,
  };
}

/** What happened to a claimed sync. */
export interface SyncResult {
  syncId: string;
  status: SyncRunOutcome['status'];
}

export interface SyncWorkerOptions {
  leases: SyncLeases;
  runner: Pick<CollectionSyncService, 'runSync'>;
  logger: JsonLogger;
  workerId: string;
  /** How often a running sync's lease is renewed. Keep it well inside the lease. */
  renewMilliseconds: number;
  /** How long to wait before polling again when no sync is waiting. */
  idleMilliseconds: number;
}

function claimFields({ sync, username }: ClaimedCollectionSync) {
  return { syncId: sync.id, username, source: sync.source, attempt: sync.attempts };
}

/**
 * Drains the waiting `collection_syncs` rows the web app queues: claims one,
 * runs it against BGG while renewing its lease, and logs how it ended. One
 * process runs one sync at a time, so its BGG rate limit is the only one.
 */
export class SyncWorker {
  readonly #options: SyncWorkerOptions;
  readonly #loop: PollLoop;

  constructor(options: SyncWorkerOptions) {
    this.#options = options;
    this.#loop = new PollLoop({ idleMilliseconds: options.idleMilliseconds });
  }

  get isStopping(): boolean {
    return this.#loop.isStopping;
  }

  /** Asks `run` to return once the sync in hand, if any, is finished. */
  stop(): void {
    this.#loop.stop();
  }

  /** Runs syncs until `stop` is called. Never rejects: a failed poll is logged and retried. */
  async run(): Promise<void> {
    await this.#loop.run({
      poll: async () => (await this.processNextSync()) !== undefined,
      onError: (error) => {
        this.#options.logger.error('Polling for collection syncs failed', {
          error: describeError(error),
        });
      },
    });
  }

  /** Claims and runs one sync. Resolves undefined when none is waiting. */
  async processNextSync(): Promise<SyncResult | undefined> {
    const { leases, runner, logger, workerId, renewMilliseconds } = this.#options;
    const claimed = await leases.claim();
    if (claimed === undefined) {
      return undefined;
    }
    logger.info('Claimed collection sync', claimFields(claimed));

    // Aborted once the run ends, so a renewal still in flight cannot report a finished sync as lost.
    const running = new AbortController();
    const heartbeat = setInterval(() => {
      void this.#renew({ claimed, signal: running.signal });
    }, renewMilliseconds);
    try {
      const outcome = await runner.runSync({ claimed, workerId });
      this.#logOutcome({ claimed, outcome });

      return { syncId: claimed.sync.id, status: outcome.status };
    } finally {
      running.abort();
      clearInterval(heartbeat);
    }
  }

  async #renew({
    claimed,
    signal,
  }: {
    claimed: ClaimedCollectionSync;
    signal: AbortSignal;
  }): Promise<void> {
    try {
      const held = await this.#options.leases.renew(claimed.sync.id);
      if (!held && !signal.aborted) {
        this.#options.logger.warn('Lost the lease on a running sync', claimFields(claimed));
      }
    } catch (error) {
      this.#options.logger.warn('Renewing a sync lease failed', {
        ...claimFields(claimed),
        error: describeError(error),
      });
    }
  }

  #logOutcome({
    claimed,
    outcome,
  }: {
    claimed: ClaimedCollectionSync;
    outcome: SyncRunOutcome;
  }): void {
    const { logger } = this.#options;
    if (outcome.status === 'succeeded') {
      logger.info('Collection sync succeeded', claimFields(claimed));
      return;
    }
    if (outcome.status === 'failed') {
      logger.warn('Collection sync failed', { ...claimFields(claimed), error: outcome.error });
      return;
    }
    if (outcome.status === 'lost') {
      logger.warn('Lost the lease before the sync finished', claimFields(claimed));
      return;
    }
    const unhandled: never = outcome;
    throw new Error(`Unhandled sync outcome ${JSON.stringify(unhandled)}`);
  }
}
