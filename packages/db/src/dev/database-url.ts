/**
 * The only place this package reads the environment. The library itself takes
 * its connection string as a parameter; only the dev scripts and tests read it.
 */
export function readDatabaseUrl(): string | undefined {
  const databaseUrl = process.env.DATABASE_URL;
  if (databaseUrl === undefined || databaseUrl === '') {
    return undefined;
  }

  return databaseUrl;
}

export function requireDatabaseUrl(): string {
  const databaseUrl = readDatabaseUrl();
  if (databaseUrl === undefined) {
    throw new Error('DATABASE_URL is not set. Copy .env.example to .env.local at the repo root.');
  }

  return databaseUrl;
}
