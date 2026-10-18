import { LOG_LEVELS, type LogLevel } from '@meeplewall/worker-runtime';
import { z } from 'zod';

// The only module that reads process.env. Every variable is required and documented in
// apps/sync-worker/.env.example.

const environmentSchema = z.object({
  DATABASE_URL: z.string().min(1),
  BGG_USER_AGENT: z.string().trim().min(1),
  BGG_API_TOKEN: z.string().trim().min(1),
  SYNC_WORKER_HEALTH_PORT: z.coerce.number().int().min(1).max(65_535),
  LOG_LEVEL: z.enum(LOG_LEVELS),
});

type Environment = Record<string, string | undefined>;

/** Everything the worker process needs. */
export interface WorkerConfig {
  databaseUrl: string;
  bggUserAgent: string;
  bggApiToken: string;
  healthPort: number;
  logLevel: LogLevel;
}

/**
 * Parses the worker's variables out of `environment`.
 *
 * @throws Error naming every missing or malformed variable, never its value.
 */
export function parseWorkerConfig(environment: Environment): WorkerConfig {
  const result = environmentSchema.safeParse(environment);
  if (!result.success) {
    const problems = result.error.issues.map(
      (issue) => `${issue.path.join('.')}: ${issue.message}`,
    );
    throw new Error(`Invalid environment. ${problems.join('; ')}`);
  }

  return {
    databaseUrl: result.data.DATABASE_URL,
    bggUserAgent: result.data.BGG_USER_AGENT,
    bggApiToken: result.data.BGG_API_TOKEN,
    healthPort: result.data.SYNC_WORKER_HEALTH_PORT,
    logLevel: result.data.LOG_LEVEL,
  };
}

/** The worker's configuration from `process.env`. Throws when any variable is missing. */
export function loadWorkerConfig(): WorkerConfig {
  return parseWorkerConfig(process.env);
}
