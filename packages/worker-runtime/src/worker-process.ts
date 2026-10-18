import { randomUUID } from 'node:crypto';
import { hostname } from 'node:os';

import { HealthServer } from './health-server.ts';
import { describeError, JsonLogger, type LogLevel } from './logger.ts';

const HEALTH_CHECK_TIMEOUT_MILLISECONDS = 2_000;

/** What a worker process runs until SIGTERM or SIGINT. */
export interface RunnableWorker {
  readonly isStopping: boolean;
  /** Asks `run` to return once the work in hand is finished. */
  stop(): void;
  run(): Promise<void>;
}

/** The settings every worker's env module resolves. */
export interface WorkerProcessConfig {
  logLevel: LogLevel;
  healthPort: number;
}

/** The worker `start` built, and how to check and release what it opened. */
export interface StartedWorker {
  worker: RunnableWorker;
  /** Rejects when a backing service is down, which fails the health check. */
  ping: () => Promise<unknown>;
  /** Releases what `start` opened, once the worker and the health server have stopped. */
  close: () => Promise<void>;
}

/** Where shutdown signals come from: `process`, or an emitter in tests. */
export interface SignalSource {
  once(signal: NodeJS.Signals, listener: (signal: NodeJS.Signals) => void): unknown;
}

/** A pool that emits `error` when an idle connection drops, such as a `pg.Pool`. */
export interface ConnectionPool {
  on(event: 'error', listener: (error: Error) => void): unknown;
}

export interface WorkerProcessOptions<Config extends WorkerProcessConfig> {
  /** Starts the lifecycle log lines: `<name> started`, `stopped` and `crashed`. */
  name: string;
  /** Logged with the signal when one arrives, such as `Stopping after the current job`. */
  stoppingMessage: string;
  loadConfig: () => Config;
  start: (context: {
    config: Config;
    logger: JsonLogger;
    workerId: string;
  }) => Promise<StartedWorker>;
  /** Receives each log line. Defaults to stdout. */
  write?: (line: string) => void;
  /** Defaults to `process`. */
  signals?: SignalSource;
}

/** Writes a log line to stdout, for whatever collects the container's output. */
export function writeStdout(line: string): void {
  process.stdout.write(line);
}

/** Unique per process, and readable in logs and lease columns: `<host>-<pid>-<random>`. */
export function createWorkerId(): string {
  return `${hostname()}-${process.pid}-${randomUUID().slice(0, 8)}`;
}

/** Logs an idle connection dropping, which Node would otherwise treat as an uncaught error. */
export function logIdleConnectionErrors({
  pool,
  logger,
}: {
  pool: ConnectionPool;
  logger: JsonLogger;
}): void {
  pool.on('error', (error) => {
    logger.error('Idle database connection failed', { error: describeError(error) });
  });
}

async function runStarted<Config extends WorkerProcessConfig>({
  options: { name, stoppingMessage, loadConfig, start, signals },
  write,
}: {
  options: WorkerProcessOptions<Config>;
  write: (line: string) => void;
}): Promise<void> {
  const config = loadConfig();
  const logger = new JsonLogger({ write, level: config.logLevel });
  const workerId = createWorkerId();
  const { worker, ping, close } = await start({ config, logger, workerId });

  const healthServer = await HealthServer.start({
    port: config.healthPort,
    timeoutMilliseconds: HEALTH_CHECK_TIMEOUT_MILLISECONDS,
    check: async () => {
      if (worker.isStopping) {
        return false;
      }
      await ping();
      return true;
    },
  });

  const shutDown = (signal: NodeJS.Signals) => {
    logger.info(stoppingMessage, { signal });
    worker.stop();
  };
  const signalSource = signals ?? process;
  signalSource.once('SIGTERM', shutDown);
  signalSource.once('SIGINT', shutDown);

  logger.info(`${name} started`, { workerId, healthPort: healthServer.port });
  await worker.run();

  await healthServer.close();
  await close();
  logger.info(`${name} stopped`, { workerId });
}

/**
 * Runs a worker process: loads its config, starts it, serves `/healthz` beside
 * it, and on SIGTERM or SIGINT lets the work in hand finish before closing the
 * health server and then whatever `start` opened. `/healthz` is 200 only while
 * the worker runs and `ping` resolves within 2 seconds.
 *
 * @returns The exit code: 0 after a clean stop, 1 after logging a crash.
 */
export async function runWorkerProcess<Config extends WorkerProcessConfig>(
  options: WorkerProcessOptions<Config>,
): Promise<number> {
  const write = options.write ?? writeStdout;
  // Reports a crash before LOG_LEVEL is known. Errors pass every level, so this drops nothing.
  const crashLogger = new JsonLogger({ write, level: 'error' });

  try {
    await runStarted({ options, write });
    return 0;
  } catch (error) {
    crashLogger.error(`${options.name} crashed`, { error: describeError(error) });
    return 1;
  }
}
