import { describe, expect, it } from 'vitest';

import { createBggCollectionClient } from './collection.ts';

// A live call to XMLAPI2. It needs a registered application's token, so it skips when
// BGG_API_TOKEN is unset rather than passing without a request.

const USER_AGENT = 'meeplewall e2e tests (+https://meeplewall.com)';
const token = process.env.BGG_API_TOKEN;

// The suite body runs even when skipped, so the client is built only inside a test.
function createClient() {
  return createBggCollectionClient({
    userAgent: USER_AGENT,
    token: token ?? '',
    requestsPerSecond: 0.5,
  });
}

describe.skipIf(token === undefined || token === '')('BGG collection against live XMLAPI2', () => {
  it('lists the games themetalfleece owns', { timeout: 180_000 }, async () => {
    const items = await createClient().fetchCollection({ username: 'themetalfleece' });

    expect(items?.length).toBeGreaterThan(10);
    expect(items?.some((item) => item.bggId === 363289 && item.owned)).toBe(true);
  });

  it('returns null for a user BGG does not know', { timeout: 180_000 }, async () => {
    expect(await createClient().fetchCollection({ username: 'no-such-user-3f9a1c' })).toBeNull();
  });
});
