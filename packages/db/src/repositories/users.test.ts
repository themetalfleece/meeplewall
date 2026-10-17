import { describe, expect, it } from 'vitest';

import { resolveTestServerUrl, useTestDatabase } from '../dev/test-database.ts';
import { ensureUser, findUser } from './users.ts';

const serverUrl = await resolveTestServerUrl();

describe.skipIf(serverUrl === undefined)('users', () => {
  const database = useTestDatabase(serverUrl);

  describe('findUser', () => {
    it('returns undefined for an unknown username', async () => {
      expect(await findUser(database(), { username: 'nobody' })).toBeUndefined();
    });

    it('matches regardless of case', async () => {
      const created = await ensureUser(database(), { username: 'Alice' });

      expect(await findUser(database(), { username: 'aLiCe' })).toEqual(created);
    });
  });

  describe('ensureUser', () => {
    it('creates the user on first sight, keeping the given spelling', async () => {
      const user = await ensureUser(database(), { username: 'Alice' });

      expect(user.bggUsername).toBe('Alice');
      expect(user.lastSyncedAt).toBeNull();
    });

    it('returns the existing user for any casing instead of a duplicate', async () => {
      const first = await ensureUser(database(), { username: 'Alice' });

      const second = await ensureUser(database(), { username: 'ALICE' });

      expect(second.id).toBe(first.id);
    });

    it('creates one user when called concurrently', async () => {
      const users = await Promise.all(
        Array.from({ length: 5 }, () => ensureUser(database(), { username: 'racer' })),
      );

      expect(new Set(users.map((user) => user.id)).size).toBe(1);
    });
  });
});
