import { describe, expect, it } from 'vitest';

import { parseWorkerConfig } from './env.ts';

const SECRET = 'a-revalidate-secret-of-at-least-32-chars';

const validEnvironment = {
  DATABASE_URL: 'postgres://meeplewall:meeplewall@localhost:5432/meeplewall',
  STORAGE_ENDPOINT: 'http://localhost:9000',
  STORAGE_ACCESS_KEY_ID: 'access-key',
  STORAGE_SECRET_ACCESS_KEY: 'secret-key',
  STORAGE_BUCKET: 'meeplewall',
  STORAGE_PUBLIC_BASE_URL: 'http://localhost:9000/meeplewall',
  STORAGE_FORCE_PATH_STYLE: 'true',
  WEB_INTERNAL_URL: 'http://localhost:3000',
  INTERNAL_REVALIDATE_SECRET: SECRET,
  IMAGE_PROCESSOR_HEALTH_PORT: '8080',
  LOG_LEVEL: 'warn',
};

type VariableName = keyof typeof validEnvironment;

function environmentWithout(name: VariableName): Record<string, string | undefined> {
  return { ...validEnvironment, [name]: undefined };
}

function errorMessageOf(run: () => unknown): string {
  try {
    run();
  } catch (error) {
    if (error instanceof Error) {
      return error.message;
    }
  }
  throw new Error('Expected an Error to be thrown');
}

describe('parseWorkerConfig', () => {
  it('maps every variable onto the config', () => {
    expect(parseWorkerConfig(validEnvironment)).toEqual({
      databaseUrl: validEnvironment.DATABASE_URL,
      storage: {
        endpoint: 'http://localhost:9000',
        accessKeyId: 'access-key',
        secretAccessKey: 'secret-key',
        bucket: 'meeplewall',
        publicBaseUrl: 'http://localhost:9000/meeplewall',
        forcePathStyle: true,
      },
      webInternalUrl: 'http://localhost:3000',
      revalidateSecret: SECRET,
      healthPort: 8080,
      logLevel: 'warn',
    });
  });

  it('parses STORAGE_FORCE_PATH_STYLE=false as false', () => {
    const config = parseWorkerConfig({ ...validEnvironment, STORAGE_FORCE_PATH_STYLE: 'false' });

    expect(config.storage.forcePathStyle).toBe(false);
  });

  it.each(Object.keys(validEnvironment))('throws naming %s when it is missing', (name) => {
    const environment = { ...validEnvironment, [name]: undefined };

    expect(() => parseWorkerConfig(environment)).toThrow(new RegExp(`\\b${name}:`));
  });

  it.each([
    ['DATABASE_URL', ''],
    ['STORAGE_FORCE_PATH_STYLE', 'maybe'],
    ['WEB_INTERNAL_URL', 'localhost:3000'],
    ['INTERNAL_REVALIDATE_SECRET', 'too-short'],
    ['IMAGE_PROCESSOR_HEALTH_PORT', '0'],
    ['IMAGE_PROCESSOR_HEALTH_PORT', '65536'],
    ['IMAGE_PROCESSOR_HEALTH_PORT', 'eighty'],
    ['LOG_LEVEL', 'verbose'],
  ] satisfies [VariableName, string][])('throws naming %s when it is %j', (name, value) => {
    expect(() => parseWorkerConfig({ ...validEnvironment, [name]: value })).toThrow(
      new RegExp(`\\b${name}:`),
    );
  });

  it('names every problem at once', () => {
    const environment = { ...environmentWithout('DATABASE_URL'), WEB_INTERNAL_URL: 'nope' };

    expect(() => parseWorkerConfig(environment)).toThrow(/DATABASE_URL:.*WEB_INTERNAL_URL:/);
  });

  it('never echoes a value into the error', () => {
    const environment = { ...validEnvironment, INTERNAL_REVALIDATE_SECRET: 'short-secret-value' };

    expect(errorMessageOf(() => parseWorkerConfig(environment))).not.toContain(
      'short-secret-value',
    );
  });
});
