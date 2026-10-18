import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MockInstance } from 'vitest';
import { z } from 'zod';

import { createBggClient } from './client.ts';
import type { BggClient } from './client.ts';
import { FIXTURE_GAME_IDS, readFixture } from './fixtures/fixtures.ts';
import type { FixtureEndpoint } from './fixtures/fixtures.ts';
import { BggHttpError, BggResponseError } from './http.ts';

const USER_AGENT = 'meeplewall tests';

type Responder = (url: URL) => Response;

function requestUrl(input: string | URL | Request): URL {
  if (input instanceof Request) {
    return new URL(input.url);
  }

  return new URL(input);
}

function endpointOf(url: URL): FixtureEndpoint {
  if (url.pathname.endsWith('/geekitems')) {
    return 'geekitems';
  }

  if (url.pathname.endsWith('/dynamicinfo')) {
    return 'dynamicinfo';
  }

  return 'versions';
}

/** Serves the recorded response for whichever endpoint and game the URL asks for. */
function replayFixture(url: URL): Response {
  const bggId = Number(url.searchParams.get('objectid'));

  return new Response(readFixture({ bggId, endpoint: endpointOf(url) }), { status: 200 });
}

function json(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200 });
}

function stubFetch(responder: Responder): MockInstance<typeof fetch> {
  return vi
    .spyOn(globalThis, 'fetch')
    .mockImplementation((input) => Promise.resolve(responder(requestUrl(input))));
}

function requestedUrls(fetchSpy: MockInstance<typeof fetch>): URL[] {
  return fetchSpy.mock.calls.map(([input]) => requestUrl(input));
}

function createClient(): BggClient {
  return createBggClient({ userAgent: USER_AGENT, requestsPerSecond: 10 });
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('createBggClient', () => {
  it('throws naming the user agent when it is blank', () => {
    expect(() => createBggClient({ userAgent: '  ', requestsPerSecond: 1 })).toThrow(/userAgent/);
  });

  it.each([0, -1, Number.NaN, 11])(
    'throws naming requestsPerSecond when it is %s',
    (requestsPerSecond) => {
      expect(() => createBggClient({ userAgent: USER_AGENT, requestsPerSecond })).toThrow(
        /requestsPerSecond/,
      );
    },
  );
});

describe('fetchGame', () => {
  it('combines geekitems and dynamicinfo into one game', async () => {
    stubFetch(replayFixture);

    const game = await createClient().fetchGame({ bggId: FIXTURE_GAME_IDS.codenames });

    expect(game).toMatchObject({
      bggId: 178900,
      name: 'Codenames',
      stats: { rank: 161, weight: 1.254 },
    });
  });

  it('sends the user agent and asks for JSON', async () => {
    const fetchSpy = stubFetch(replayFixture);

    await createClient().fetchGame({ bggId: FIXTURE_GAME_IDS.celts });

    expect(fetchSpy).toHaveBeenCalledTimes(2);

    for (const [, init] of fetchSpy.mock.calls) {
      expect(init?.headers).toEqual({ 'User-Agent': USER_AGENT, Accept: 'application/json' });
    }
  });

  it('asks geekdo for the right object', async () => {
    const fetchSpy = stubFetch(replayFixture);

    await createClient().fetchGame({ bggId: FIXTURE_GAME_IDS.celts });

    expect(requestedUrls(fetchSpy).map((url) => url.toString())).toEqual([
      'https://api.geekdo.com/api/geekitems?objectid=40832&objecttype=thing',
      'https://api.geekdo.com/api/dynamicinfo?objectid=40832&objecttype=thing',
    ]);
  });

  it('returns null for an id BGG does not know, without asking for its stats', async () => {
    const fetchSpy = stubFetch(() => new Response('null', { status: 404 }));

    expect(await createClient().fetchGame({ bggId: 999_999_999 })).toBeNull();
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('keeps the game when only the stats are missing', async () => {
    stubFetch((url) =>
      endpointOf(url) === 'dynamicinfo'
        ? new Response('null', { status: 404 })
        : replayFixture(url),
    );

    const game = await createClient().fetchGame({ bggId: FIXTURE_GAME_IDS.codenames });

    expect(game).toMatchObject({ name: 'Codenames', stats: null });
  });

  it.each([0, -3, 1.5, Number.NaN])('rejects the id %s without a request', async (bggId) => {
    const fetchSpy = stubFetch(replayFixture);

    await expect(createClient().fetchGame({ bggId })).rejects.toThrow(RangeError);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('retries after a 429 and then succeeds', async () => {
    vi.useFakeTimers();
    let geekitemCalls = 0;
    const fetchSpy = stubFetch((url) => {
      if (endpointOf(url) === 'geekitems') {
        geekitemCalls += 1;

        if (geekitemCalls === 1) {
          return new Response('slow down', { status: 429 });
        }
      }

      return replayFixture(url);
    });

    const pending = createClient().fetchGame({ bggId: FIXTURE_GAME_IDS.codenames });
    await vi.runAllTimersAsync();

    expect(await pending).toMatchObject({ name: 'Codenames' });
    expect(geekitemCalls).toBe(2);
    expect(fetchSpy).toHaveBeenCalledTimes(3);
  });

  it('waits out the backoff before retrying', async () => {
    vi.useFakeTimers();
    const fetchSpy = stubFetch((url) => {
      if (fetchSpy.mock.calls.length === 1) {
        return new Response('busy', { status: 503, headers: { 'Retry-After': '3' } });
      }

      return replayFixture(url);
    });

    const pending = createClient().fetchGameVersions({ bggId: FIXTURE_GAME_IDS.celts });
    await vi.advanceTimersByTimeAsync(2999);

    expect(fetchSpy).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1);
    await pending;

    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('gives up after five 503s with the status', async () => {
    vi.useFakeTimers();
    const fetchSpy = stubFetch(() => new Response('busy', { status: 503 }));

    const pending = createClient().fetchGameVersions({ bggId: FIXTURE_GAME_IDS.celts });
    const assertion = expect(pending).rejects.toMatchObject({
      name: 'BggHttpError',
      status: 503,
    });
    await vi.runAllTimersAsync();
    await assertion;

    expect(fetchSpy).toHaveBeenCalledTimes(5);
  });

  it('throws on a status it does not retry, without retrying', async () => {
    const fetchSpy = stubFetch(() => new Response('nope', { status: 500 }));

    await expect(
      createClient().fetchGameVersions({ bggId: FIXTURE_GAME_IDS.celts }),
    ).rejects.toBeInstanceOf(BggHttpError);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('rejects a body that is not JSON', async () => {
    stubFetch(() => new Response('<html>Cloudflare</html>', { status: 200 }));

    await expect(createClient().fetchGame({ bggId: FIXTURE_GAME_IDS.codenames })).rejects.toThrow(
      /not JSON/,
    );
  });

  it('rejects JSON that does not match the schema, naming the field', async () => {
    stubFetch((url) =>
      endpointOf(url) === 'geekitems'
        ? json({ item: { objectid: 178900, links: {} } })
        : replayFixture(url),
    );

    const pending = createClient().fetchGame({ bggId: FIXTURE_GAME_IDS.codenames });

    await expect(pending).rejects.toBeInstanceOf(BggResponseError);
    await expect(pending).rejects.toThrow(/item\.name/);
  });
});

describe('fetchGameVersions', () => {
  it('returns every version of a game on one page', async () => {
    const fetchSpy = stubFetch(replayFixture);

    const versions = await createClient().fetchGameVersions({ bggId: FIXTURE_GAME_IDS.celts });

    expect(versions.length).toBeGreaterThan(0);
    expect(versions.length).toBeLessThan(50);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(requestedUrls(fetchSpy)[0]?.searchParams.get('linkdata_index')).toBe('boardgameversion');
  });

  it('pages on while a page comes back full', async () => {
    const fetchSpy = stubFetch((url) =>
      url.searchParams.get('pageid') === '1' ? replayFixture(url) : json({ items: [] }),
    );

    const versions = await createClient().fetchGameVersions({
      bggId: FIXTURE_GAME_IDS.codenames,
    });

    expect(versions).toHaveLength(50);
    expect(requestedUrls(fetchSpy).map((url) => url.searchParams.get('pageid'))).toEqual([
      '1',
      '2',
    ]);
  });

  it('stops once it holds the total count', async () => {
    const { items } = z
      .object({ items: z.array(z.unknown()) })
      .parse(JSON.parse(readFixture({ bggId: FIXTURE_GAME_IDS.codenames, endpoint: 'versions' })));
    const fetchSpy = stubFetch(() => json({ items, config: { numitems: '50' } }));

    const versions = await createClient().fetchGameVersions({
      bggId: FIXTURE_GAME_IDS.codenames,
    });

    expect(versions).toHaveLength(50);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('returns an empty list for a game with no versions', async () => {
    stubFetch(() => json({ items: [] }));

    expect(await createClient().fetchGameVersions({ bggId: 1 })).toEqual([]);
  });

  it('returns an empty list for an id BGG does not know', async () => {
    stubFetch(() => new Response('null', { status: 404 }));

    expect(await createClient().fetchGameVersions({ bggId: 999_999_999 })).toEqual([]);
  });
});

describe('rate limiting', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('never starts more requests per second than the cap', async () => {
    const startedAt: number[] = [];
    const start = Date.now();
    stubFetch((url) => {
      startedAt.push(Date.now() - start);

      return replayFixture(url);
    });
    const client = createBggClient({ userAgent: USER_AGENT, requestsPerSecond: 2 });

    const pending = Promise.all([
      client.fetchGame({ bggId: FIXTURE_GAME_IDS.codenames }),
      client.fetchGame({ bggId: FIXTURE_GAME_IDS.celts }),
    ]);
    await vi.runAllTimersAsync();
    await pending;

    expect(startedAt).toEqual([0, 500, 1000, 1500]);
  });
});
