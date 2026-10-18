import { z } from 'zod';

// The only module that reads process.env. Each accessor resolves its variable on first use, so a
// missing one fails where it is needed, naming it. Every variable is documented in
// apps/web/.env.example, and none has a default.

const httpUrlSchema = z.url({ protocol: /^https?$/ });

const variableSchemas = {
  SITE_URL: httpUrlSchema,
  DATABASE_URL: z.string().min(1),
  STORAGE_PUBLIC_BASE_URL: httpUrlSchema,
  INTERNAL_REVALIDATE_SECRET: z.string().min(32, 'must be at least 32 characters'),
};

type VariableName = keyof typeof variableSchemas;

type Environment = Record<string, string | undefined>;

/**
 * Parses one variable out of `environment`.
 *
 * @throws Error naming the variable and the problem, never its value.
 */
export function readVariable({
  name,
  environment,
}: {
  name: VariableName;
  environment: Environment;
}): string {
  const value = environment[name];
  if (value === undefined || value === '') {
    throw new Error(`${name} is not set. See apps/web/.env.example.`);
  }

  const result = variableSchemas[name].safeParse(value);
  if (!result.success) {
    const problems = result.error.issues.map((issue) => issue.message).join('; ');
    throw new Error(`${name} is invalid: ${problems}`);
  }

  return result.data;
}

function fromProcess(name: VariableName): string {
  return readVariable({ name, environment: process.env });
}

/** The public origin of the site, for `metadataBase` and absolute links. */
export function siteUrl(): URL {
  return new URL(fromProcess('SITE_URL'));
}

export function databaseUrl(): string {
  return fromProcess('DATABASE_URL');
}

/** Where processed images are served from, without a trailing key. */
export function storagePublicBaseUrl(): string {
  return fromProcess('STORAGE_PUBLIC_BASE_URL');
}

/** Server-only: the secret the image processor sends to the revalidate route. */
export function internalRevalidateSecret(): string {
  return fromProcess('INTERNAL_REVALIDATE_SECRET');
}
