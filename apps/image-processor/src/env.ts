import type { StorageOptions } from '@board-games/storage';
import { z } from 'zod';

// The only module that reads process.env. Every variable is required and documented in the repo
// root .env.example.

const serviceEnvironmentSchema = z.object({
  DATABASE_URL: z.string().min(1),
  // createStorage validates the values themselves.
  STORAGE_ENDPOINT: z.string(),
  STORAGE_ACCESS_KEY_ID: z.string(),
  STORAGE_SECRET_ACCESS_KEY: z.string(),
  STORAGE_BUCKET: z.string(),
  STORAGE_PUBLIC_BASE_URL: z.string(),
  STORAGE_FORCE_PATH_STYLE: z.stringbool(),
});

const workerEnvironmentSchema = serviceEnvironmentSchema.extend({
  WEB_INTERNAL_URL: z.url({ protocol: /^https?$/ }),
  INTERNAL_REVALIDATE_SECRET: z.string().min(32, 'must be at least 32 characters'),
  IMAGE_PROCESSOR_HEALTH_PORT: z.coerce.number().int().min(1).max(65_535),
});

type Environment = Record<string, string | undefined>;

/** The backing services: Postgres and the bucket. */
export interface ServiceConfig {
  databaseUrl: string;
  storage: StorageOptions;
}

/** Everything the worker process needs. */
export interface WorkerConfig extends ServiceConfig {
  webInternalUrl: string;
  revalidateSecret: string;
  healthPort: number;
}

function toServiceConfig(values: z.output<typeof serviceEnvironmentSchema>): ServiceConfig {
  return {
    databaseUrl: values.DATABASE_URL,
    storage: {
      endpoint: values.STORAGE_ENDPOINT,
      accessKeyId: values.STORAGE_ACCESS_KEY_ID,
      secretAccessKey: values.STORAGE_SECRET_ACCESS_KEY,
      bucket: values.STORAGE_BUCKET,
      publicBaseUrl: values.STORAGE_PUBLIC_BASE_URL,
      forcePathStyle: values.STORAGE_FORCE_PATH_STYLE,
    },
  };
}

/**
 * Parses the worker's variables out of `environment`.
 *
 * @throws Error naming every missing or malformed variable, never its value.
 */
export function parseWorkerConfig(environment: Environment): WorkerConfig {
  const result = workerEnvironmentSchema.safeParse(environment);
  if (!result.success) {
    const problems = result.error.issues.map(
      (issue) => `${issue.path.join('.')}: ${issue.message}`,
    );
    throw new Error(`Invalid environment. ${problems.join('; ')}`);
  }

  return {
    ...toServiceConfig(result.data),
    webInternalUrl: result.data.WEB_INTERNAL_URL,
    revalidateSecret: result.data.INTERNAL_REVALIDATE_SECRET,
    healthPort: result.data.IMAGE_PROCESSOR_HEALTH_PORT,
  };
}

/** The worker's configuration from `process.env`. Throws when any variable is missing. */
export function loadWorkerConfig(): WorkerConfig {
  return parseWorkerConfig(process.env);
}

/** The backing services from `process.env`, or undefined when any is unset. For the test suites. */
export function readServiceConfig(): ServiceConfig | undefined {
  const result = serviceEnvironmentSchema.safeParse(process.env);
  if (!result.success) {
    return undefined;
  }

  return toServiceConfig(result.data);
}

/** True under CI, where a suite must fail rather than skip when a service is missing. */
export function isContinuousIntegration(): boolean {
  return process.env.CI !== undefined;
}
