import type { SyncRunOutcome } from '@meeplewall/collection-sync';
import type { ClaimedCollectionSync, CollectionSync } from '@meeplewall/db';
import { JsonLogger } from '@meeplewall/worker-runtime';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { SyncWorker, type SyncLeases } from './worker.ts';

const WORKER_ID = 'sync-worker-test';
const RENEW_MILLISECONDS = 1_000;

const logEntrySchema = z.looseObject({ level: z.string(), message: z.string() });

function claimedSync(id: string): ClaimedCollectionSync {
  const sync: CollectionSync = {
    id,
    userId: `user-${id}`,
    status: 'running',
    source: 'api',
    error: null,
    attempts: 1,
    lockedBy: WORKER_ID,
    lockedUntil: new Date(Date.now() + 60_000),
    startedAt: new Date(),
    finishedAt: null,
  };

  return { sync, username: `player-${id}` };
}

/** Hands out the queued syncs in order and answers every renewal with `held`. */
class FakeLeases implements SyncLeases {
  readonly renewed: string[] = [];
  held = true;
  readonly #queue: ClaimedCollectionSync[];

  constructor(queue: ClaimedCollectionSync[]) {
    this.#queue = queue;
  }

  claim(): Promise<ClaimedCollectionSync | undefined> {
    return Promise.resolve(this.#queue.shift());
  }

  renew(syncId: string): Promise<boolean> {
    this.renewed.push(syncId);
    return Promise.resolve(this.held);
  }
}

function createWorker({
  leases,
  runSync,
}: {
  leases: SyncLeases;
  runSync: (options: {
    claimed: ClaimedCollectionSync;
    workerId: string;
  }) => Promise<SyncRunOutcome>;
}) {
  const lines: string[] = [];
  const worker = new SyncWorker({
    leases,
    runner: { runSync },
    logger: new JsonLogger({ write: (line) => lines.push(line) }),
    workerId: WORKER_ID,
    renewMilliseconds: RENEW_MILLISECONDS,
    idleMilliseconds: 1,
  });
  const logs = () => lines.map((line) => logEntrySchema.parse(JSON.parse(line)));

  return { worker, logs };
}

describe('SyncWorker', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('resolves undefined and runs nothing when no sync is waiting', async () => {
    const runSync = vi.fn<() => Promise<SyncRunOutcome>>();
    const { worker } = createWorker({ leases: new FakeLeases([]), runSync });

    expect(await worker.processNextSync()).toBeUndefined();
    expect(runSync).not.toHaveBeenCalled();
  });

  it('runs the claimed sync as this worker and reports how it ended', async () => {
    const claimed = claimedSync('a');
    const runSync = vi.fn(() => Promise.resolve<SyncRunOutcome>({ status: 'succeeded' }));
    const { worker, logs } = createWorker({ leases: new FakeLeases([claimed]), runSync });

    expect(await worker.processNextSync()).toEqual({ syncId: 'a', status: 'succeeded' });
    expect(runSync).toHaveBeenCalledWith({ claimed, workerId: WORKER_ID });
    expect(logs().map(({ message }) => message)).toEqual([
      'Claimed collection sync',
      'Collection sync succeeded',
    ]);
  });

  it.each([
    [{ status: 'failed', error: 'BGG answered 500' }, 'Collection sync failed'],
    [{ status: 'lost' }, 'Lost the lease before the sync finished'],
  ] satisfies [SyncRunOutcome, string][])(
    'logs a %j outcome as a warning',
    async (outcome, message) => {
      const { worker, logs } = createWorker({
        leases: new FakeLeases([claimedSync('a')]),
        runSync: () => Promise.resolve(outcome),
      });

      expect(await worker.processNextSync()).toEqual({ syncId: 'a', status: outcome.status });
      expect(logs().at(-1)).toMatchObject({ level: 'warn', message });
    },
  );

  it('renews the lease while a sync runs and stops once it ends', async () => {
    vi.useFakeTimers();
    const leases = new FakeLeases([claimedSync('a')]);
    let finish: (outcome: SyncRunOutcome) => void = () => {};
    const { worker } = createWorker({
      leases,
      runSync: () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    });

    const processing = worker.processNextSync();
    await vi.advanceTimersByTimeAsync(RENEW_MILLISECONDS * 3);
    finish({ status: 'succeeded' });
    await processing;
    await vi.advanceTimersByTimeAsync(RENEW_MILLISECONDS * 3);

    expect(leases.renewed).toEqual(['a', 'a', 'a']);
  });

  it('warns when a renewal finds the lease gone', async () => {
    vi.useFakeTimers();
    const leases = new FakeLeases([claimedSync('a')]);
    leases.held = false;
    let finish: (outcome: SyncRunOutcome) => void = () => {};
    const { worker, logs } = createWorker({
      leases,
      runSync: () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    });

    const processing = worker.processNextSync();
    await vi.advanceTimersByTimeAsync(RENEW_MILLISECONDS);
    finish({ status: 'lost' });
    await processing;

    expect(logs().map(({ message }) => message)).toContain('Lost the lease on a running sync');
  });

  it('runs every waiting sync, then keeps polling until stopped', async () => {
    const leases = new FakeLeases([claimedSync('a'), claimedSync('b')]);
    const ran: string[] = [];
    const { worker } = createWorker({
      leases,
      runSync: ({ claimed }) => {
        ran.push(claimed.sync.id);
        if (ran.length === 2) {
          setTimeout(() => {
            worker.stop();
          }, 20);
        }
        return Promise.resolve({ status: 'succeeded' });
      },
    });

    await worker.run();

    expect(ran).toEqual(['a', 'b']);
    expect(worker.isStopping).toBe(true);
  });

  it('logs a sync that throws and keeps running', async () => {
    const leases = new FakeLeases([claimedSync('a'), claimedSync('b')]);
    const ran: string[] = [];
    const { worker, logs } = createWorker({
      leases,
      runSync: ({ claimed }) => {
        ran.push(claimed.sync.id);
        if (claimed.sync.id === 'a') {
          return Promise.reject(new Error('database is down'));
        }
        worker.stop();
        return Promise.resolve({ status: 'succeeded' });
      },
    });

    await worker.run();

    expect(ran).toEqual(['a', 'b']);
    expect(logs()).toContainEqual(
      expect.objectContaining({ level: 'error', message: 'Polling for collection syncs failed' }),
    );
  });
});
