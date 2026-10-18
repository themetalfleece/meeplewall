import { describe, expect, it } from 'vitest';

import { parseWorkerConfig } from './env.ts';

const validEnvironment = {
  DATABASE_URL: 'postgres://meeplewall:meeplewall@localhost:5432/meeplewall',
  BGG_USER_AGENT: 'meeplewall tests',
  BGG_API_TOKEN: 'a-bgg-token',
  SYNC_WORKER_HEALTH_PORT: '8081',
  LOG_LEVEL: 'warn',
};

type VariableName = keyof typeof validEnvironment;

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
      bggUserAgent: 'meeplewall tests',
      bggApiToken: 'a-bgg-token',
      healthPort: 8081,
      logLevel: 'warn',
    });
  });

  it.each(Object.keys(validEnvironment))('throws naming %s when it is missing', (name) => {
    const environment = { ...validEnvironment, [name]: undefined };

    expect(() => parseWorkerConfig(environment)).toThrow(new RegExp(`\\b${name}:`));
  });

  it.each([
    ['DATABASE_URL', ''],
    ['BGG_USER_AGENT', '   '],
    ['BGG_API_TOKEN', ''],
    ['SYNC_WORKER_HEALTH_PORT', '0'],
    ['SYNC_WORKER_HEALTH_PORT', '65536'],
    ['SYNC_WORKER_HEALTH_PORT', 'eighty'],
    ['LOG_LEVEL', 'verbose'],
  ] satisfies [VariableName, string][])('throws naming %s when it is %j', (name, value) => {
    expect(() => parseWorkerConfig({ ...validEnvironment, [name]: value })).toThrow(
      new RegExp(`\\b${name}:`),
    );
  });

  it('names every problem at once', () => {
    const environment = { ...validEnvironment, DATABASE_URL: '', BGG_API_TOKEN: undefined };

    expect(() => parseWorkerConfig(environment)).toThrow(/DATABASE_URL:.*BGG_API_TOKEN:/);
  });

  it('never echoes a value into the error', () => {
    const environment = { ...validEnvironment, SYNC_WORKER_HEALTH_PORT: 'secret-looking-value' };

    expect(errorMessageOf(() => parseWorkerConfig(environment))).not.toContain(
      'secret-looking-value',
    );
  });
});
