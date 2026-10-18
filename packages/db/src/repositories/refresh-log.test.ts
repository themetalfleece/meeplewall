import { describe, expect, it } from 'vitest';

import { resolveTestServerUrl, useTestDatabase } from '../dev/test-database.ts';
import { recordRefresh } from './refresh-log.ts';
import { ensureUser } from './users.ts';

const serverUrl = await resolveTestServerUrl();

describe.skipIf(serverUrl === undefined)('refresh log', () => {
  const database = useTestDatabase(serverUrl);

  describe('recordRefresh', () => {
    it('stores the entry with a request time', async () => {
      const user = await ensureUser(database(), { username: 'alice' });

      const entry = await recordRefresh(database(), {
        entry: { userId: user.id, source: 'user', status: 'failed', durationMs: 1_250 },
      });

      expect(entry).toMatchObject({
        userId: user.id,
        source: 'user',
        status: 'failed',
        durationMs: 1_250,
      });
      expect(entry.requestedAt).toBeInstanceOf(Date);
    });
  });
});
