import { EventEmitter } from 'node:events';
import { hostname } from 'node:os';

import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { JsonLogger, LOG_LEVELS } from './logger.ts';
import {
  createWorkerId,
  logIdleConnectionErrors,
  runWorkerProcess,
  type RunnableWorker,
  type StartedWorker,
  type WorkerProcessConfig,
} from './worker-process.ts';

const logEntrySchema = z.looseObject({
  level: z.enum(LOG_LEVELS),
  message: z.string(),
});

const startedEntrySchema = z.looseObject({
  message: z.literal('Test worker started'),
  workerId: z.string(),
  healthPort: z.number(),
});

/** Runs until stopped, recording each call in `events`. */
class FakeWorker implements RunnableWorker {
  isStopping = false;
  readonly #events: string[];
  #finish: () => void = () => {};

  constructor(events: string[]) {
    this.#events = events;
  }

  stop(): void {
    this.#events.push('stop');
    this.isStopping = true;
    this.#finish();
  }

  async run(): Promise<void> {
    this.#events.push('run');
    await new Promise<void>((resolve) => {
      this.#finish = resolve;
    });
    this.#events.push('run returned');
  }
}

function parseLines(lines: string[]) {
  return lines.map((line) => logEntrySchema.parse(JSON.parse(line)));
}

/** A worker process wired to fakes, with every log line and lifecycle event captured. */
function startFakeProcess({
  config = { logLevel: 'info', healthPort: 0 },
  overrides = {},
}: {
  config?: WorkerProcessConfig;
  overrides?: Partial<StartedWorker>;
} = {}) {
  const lines: string[] = [];
  const events: string[] = [];
  const signals = new EventEmitter();
  const worker = new FakeWorker(events);
  const workerIds: string[] = [];

  const exitCode = runWorkerProcess({
    name: 'Test worker',
    stoppingMessage: 'Stopping after the current task',
    loadConfig: () => config,
    start: ({ workerId }) => {
      workerIds.push(workerId);
      return Promise.resolve({
        worker,
        ping: () => Promise.resolve(),
        close: () => {
          events.push('close');
          return Promise.resolve();
        },
        ...overrides,
      });
    },
    write: (line) => lines.push(line),
    signals,
  });

  /** Resolves once the worker runs, which is after the signal listeners are attached. */
  async function running(): Promise<void> {
    await vi.waitFor(() => {
      expect(events).toContain('run');
    });
  }

  /** The started log line, once the process is running. */
  async function startedEntry() {
    await running();
    const startedLine = lines.find((line) => line.includes('Test worker started'));
    return startedEntrySchema.parse(JSON.parse(startedLine ?? ''));
  }

  async function healthUrl(): Promise<string> {
    const { healthPort } = await startedEntry();
    return `http://127.0.0.1:${healthPort}/healthz`;
  }

  async function stop(signal: NodeJS.Signals = 'SIGTERM'): Promise<number> {
    signals.emit(signal, signal);
    return exitCode;
  }

  return { lines, events, worker, workerIds, running, startedEntry, healthUrl, stop };
}

describe('runWorkerProcess', () => {
  it('logs the start with the worker id it gave start and the port /healthz is on', async () => {
    const fake = startFakeProcess();

    const started = await fake.startedEntry();
    await fake.stop();

    expect(started.workerId).toBe(fake.workerIds[0]);
    expect(started.healthPort).toBeGreaterThan(0);
  });

  it('answers /healthz with 200 while the worker runs and the ping resolves', async () => {
    const fake = startFakeProcess();

    const response = await fetch(await fake.healthUrl());
    await fake.stop();

    expect(response.status).toBe(200);
  });

  it('answers /healthz with 503 when the ping rejects', async () => {
    const fake = startFakeProcess({
      overrides: { ping: () => Promise.reject(new Error('connection refused')) },
    });

    const response = await fetch(await fake.healthUrl());
    await fake.stop();

    expect(response.status).toBe(503);
  });

  it('answers /healthz with 503 once the worker is stopping', async () => {
    const fake = startFakeProcess();
    const url = await fake.healthUrl();
    fake.worker.isStopping = true;

    const response = await fetch(url);
    await fake.stop();

    expect(response.status).toBe(503);
  });

  it.each(['SIGTERM', 'SIGINT'] as const)(
    'on %s lets the worker finish, then closes the health server, then what start opened',
    async (signal) => {
      let url = '';
      let healthWhileClosing = '';
      const fake = startFakeProcess({
        overrides: {
          close: async () => {
            healthWhileClosing = await fetch(url).then(
              () => 'open',
              () => 'closed',
            );
          },
        },
      });
      url = await fake.healthUrl();

      const exitCode = await fake.stop(signal);

      expect(exitCode).toBe(0);
      expect(fake.events).toEqual(['run', 'stop', 'run returned']);
      expect(healthWhileClosing).toBe('closed');
      expect(parseLines(fake.lines)).toEqual([
        expect.objectContaining({ level: 'info', message: 'Test worker started' }),
        expect.objectContaining({
          level: 'info',
          message: 'Stopping after the current task',
          signal,
        }),
        expect.objectContaining({ level: 'info', message: 'Test worker stopped' }),
      ]);
    },
  );

  it('drops log lines below the configured level', async () => {
    const fake = startFakeProcess({ config: { logLevel: 'warn', healthPort: 0 } });

    await fake.running();
    const exitCode = await fake.stop();

    expect(exitCode).toBe(0);
    expect(fake.events).toEqual(['run', 'stop', 'run returned', 'close']);
    expect(fake.lines).toEqual([]);
  });

  it('logs a crash in loadConfig at error level, never starts, and exits 1', async () => {
    const lines: string[] = [];
    let started = false;

    const exitCode = await runWorkerProcess({
      name: 'Test worker',
      stoppingMessage: 'Stopping',
      loadConfig: () => {
        throw new Error('Invalid environment. LOG_LEVEL: Required');
      },
      start: () => {
        started = true;
        return Promise.reject(new Error('unreachable'));
      },
      write: (line) => lines.push(line),
      signals: new EventEmitter(),
    });

    expect(exitCode).toBe(1);
    expect(started).toBe(false);
    expect(parseLines(lines)).toEqual([
      expect.objectContaining({
        level: 'error',
        message: 'Test worker crashed',
        error: 'Invalid environment. LOG_LEVEL: Required',
      }),
    ]);
  });

  it('logs a crash in start and exits 1', async () => {
    const lines: string[] = [];

    const exitCode = await runWorkerProcess({
      name: 'Test worker',
      stoppingMessage: 'Stopping',
      loadConfig: () => ({ logLevel: 'error', healthPort: 0 }),
      start: () => Promise.reject(new Error('migration failed')),
      write: (line) => lines.push(line),
      signals: new EventEmitter(),
    });

    expect(exitCode).toBe(1);
    expect(parseLines(lines)).toEqual([
      expect.objectContaining({
        level: 'error',
        message: 'Test worker crashed',
        error: 'migration failed',
      }),
    ]);
  });
});

describe('createWorkerId', () => {
  it('names the host and process, then a random suffix', () => {
    const workerId = createWorkerId();

    expect(workerId.startsWith(`${hostname()}-${process.pid}-`)).toBe(true);
    expect(workerId).toMatch(/-[0-9a-f]{8}$/);
  });

  it('differs between calls in one process', () => {
    expect(createWorkerId()).not.toBe(createWorkerId());
  });
});

describe('logIdleConnectionErrors', () => {
  it('logs each error the pool emits', () => {
    const lines: string[] = [];
    const pool = new EventEmitter();

    logIdleConnectionErrors({
      pool,
      logger: new JsonLogger({ write: (line) => lines.push(line), level: 'error' }),
    });
    pool.emit('error', new Error('terminating connection due to administrator command'));

    expect(parseLines(lines)).toEqual([
      expect.objectContaining({
        level: 'error',
        message: 'Idle database connection failed',
        error: 'terminating connection due to administrator command',
      }),
    ]);
  });

  it('logs nothing while the pool is quiet', () => {
    const lines: string[] = [];

    logIdleConnectionErrors({
      pool: new EventEmitter(),
      logger: new JsonLogger({ write: (line) => lines.push(line), level: 'info' }),
    });

    expect(lines).toEqual([]);
  });
});
