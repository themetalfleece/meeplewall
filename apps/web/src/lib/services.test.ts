import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { on } = vi.hoisted(() => ({ on: vi.fn() }));

vi.mock('@meeplewall/db', () => ({
  createDatabase: vi.fn(() => ({ $client: { on } })),
}));

const { createDatabase } = await import('@meeplewall/db');
const { getDatabase } = await import('./services');

beforeEach(() => {
  globalThis.meeplewallServices = undefined;
  vi.stubEnv('DATABASE_URL', 'postgres://localhost/test');
});

afterEach(() => {
  globalThis.meeplewallServices = undefined;
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe('getDatabase', () => {
  it('opens the pool once and reuses it', () => {
    const first = getDatabase();

    expect(getDatabase()).toBe(first);
    expect(createDatabase).toHaveBeenCalledTimes(1);
    expect(createDatabase).toHaveBeenCalledWith({ connectionString: 'postgres://localhost/test' });
  });

  it('logs idle pool errors instead of crashing', () => {
    getDatabase();

    expect(on).toHaveBeenCalledWith('error', expect.any(Function));
  });
});
