import { afterEach, describe, expect, it, vi } from 'vitest';
import type { MockInstance } from 'vitest';

import { createBggCollectionClient } from './collection.ts';
import type { BggCollectionClient } from './collection.ts';
import { readCollectionFixture } from './fixtures/fixtures.ts';
import { BggHttpError, BggResponseError } from './http.ts';

const USER_AGENT = 'meeplewall tests';
const TOKEN = 'test-token';

function xml(body: string, status = 200): Response {
  return new Response(body, { status, headers: { 'content-type': 'text/xml' } });
}

function stubResponses(...responses: Response[]): MockInstance<typeof fetch> {
  const spy = vi.spyOn(globalThis, 'fetch');
  for (const response of responses) {
    spy.mockResolvedValueOnce(response);
  }

  return spy;
}

function createClient(): BggCollectionClient {
  return createBggCollectionClient({ userAgent: USER_AGENT, token: TOKEN, requestsPerSecond: 10 });
}

/** Runs `fetchCollection` to completion under fake timers, so queued retries do not wait. */
async function fetchWithFakeTimers(username: string) {
  vi.useFakeTimers();
  const result = createClient().fetchCollection({ username });
  const settled = result.then(
    () => undefined,
    () => undefined,
  );
  await vi.runAllTimersAsync();
  await settled;

  return result;
}

/** An entry with every status flag clear and no rating. */
const NO_STATUS = {
  owned: false,
  previouslyOwned: false,
  forTrade: false,
  wantInTrade: false,
  wantToPlay: false,
  wantToBuy: false,
  wishlist: false,
  wishlistPriority: null,
  preordered: false,
  userRating: null,
};

/** A `<status>` element's flag attributes, every one `0` unless overridden. */
function statusAttributes(overrides: Record<string, string>): string {
  const flags = {
    own: '0',
    prevowned: '0',
    fortrade: '0',
    want: '0',
    wanttoplay: '0',
    wanttobuy: '0',
    wishlist: '0',
    preordered: '0',
    ...overrides,
  };

  return Object.entries(flags)
    .map(([name, value]) => `${name}="${value}"`)
    .join(' ');
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('createBggCollectionClient', () => {
  it('throws naming the token when it is blank', () => {
    expect(() =>
      createBggCollectionClient({ userAgent: USER_AGENT, token: ' ', requestsPerSecond: 1 }),
    ).toThrow(/token/);
  });

  it('reports the XMLAPI2 transport', () => {
    expect(createClient().transport).toBe('xmlapi2');
  });
});

describe('fetchCollection', () => {
  it('returns every game with a status flag, its flags and the user rating', async () => {
    stubResponses(xml(readCollectionFixture()));

    const items = await createClient().fetchCollection({ username: 'themetalfleece' });

    expect(items).toEqual([
      { ...NO_STATUS, bggId: 363289, owned: true, userRating: 8.5 },
      { ...NO_STATUS, bggId: 178900, wantToPlay: true },
      { ...NO_STATUS, bggId: 40832, previouslyOwned: true, wishlist: true, wishlistPriority: 3 },
      { ...NO_STATUS, bggId: 324937, owned: true, forTrade: true, wantToPlay: true, userRating: 7 },
    ]);
  });

  it('drops entries with no status flag', async () => {
    stubResponses(xml(readCollectionFixture()));

    const items = await createClient().fetchCollection({ username: 'themetalfleece' });

    expect(items?.map((item) => item.bggId)).not.toContain(423432);
  });

  it('merges the flags of a game listed once per copy', async () => {
    stubResponses(xml(readCollectionFixture()));

    const items = await createClient().fetchCollection({ username: 'themetalfleece' });

    expect(items?.filter((item) => item.bggId === 324937)).toEqual([
      expect.objectContaining({ owned: true, forTrade: true, wantToPlay: true, userRating: 7 }),
    ]);
  });

  it('ignores a wishlist priority on a game that is not wishlisted', async () => {
    stubResponses(
      xml(
        `<items totalitems="1"><item objectid="5"><status ${statusAttributes({ own: '1' })} wishlistpriority="2" /></item></items>`,
      ),
    );

    const items = await createClient().fetchCollection({ username: 'alice' });

    expect(items).toEqual([{ ...NO_STATUS, bggId: 5, owned: true }]);
  });

  it('asks for base games with stats, with the bearer token and user agent', async () => {
    const fetchSpy = stubResponses(xml(readCollectionFixture()));

    await createClient().fetchCollection({ username: 'the metal fleece' });

    const [input, init] = fetchSpy.mock.calls[0] ?? [];
    expect(input).toBe(
      'https://boardgamegeek.com/xmlapi2/collection?username=the+metal+fleece&subtype=boardgame&excludesubtype=boardgameexpansion&stats=1',
    );
    expect(init?.headers).toEqual({
      Accept: 'application/xml',
      Authorization: `Bearer ${TOKEN}`,
      'User-Agent': USER_AGENT,
    });
  });

  it('returns an empty list for an empty collection', async () => {
    stubResponses(xml('<items totalitems="0" termsofuse="https://boardgamegeek.com"></items>'));

    expect(await createClient().fetchCollection({ username: 'empty' })).toEqual([]);
  });

  it('returns null when BGG reports an invalid username', async () => {
    stubResponses(
      xml('<errors><error><message>Invalid username specified</message></error></errors>'),
    );

    expect(await createClient().fetchCollection({ username: 'ghost' })).toBeNull();
  });

  it('throws any other BGG error message', async () => {
    stubResponses(xml('<errors><error><message>Rate limit exceeded</message></error></errors>'));

    await expect(createClient().fetchCollection({ username: 'alice' })).rejects.toThrow(
      /Rate limit exceeded/,
    );
  });

  it('retries while BGG is still building the collection', async () => {
    const fetchSpy = stubResponses(
      xml('<message>Your request has been accepted</message>', 202),
      xml(readCollectionFixture()),
    );

    const items = await fetchWithFakeTimers('themetalfleece');

    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(items).toHaveLength(4);
  });

  it('gives up when BGG keeps the collection queued', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
      Promise.resolve(xml('<message>Still queued</message>', 202)),
    );

    await expect(fetchWithFakeTimers('patient')).rejects.toThrow(BggHttpError);
  });

  it('throws BggHttpError on an unauthorised token', async () => {
    stubResponses(xml('', 401));

    await expect(createClient().fetchCollection({ username: 'alice' })).rejects.toMatchObject({
      name: 'BggHttpError',
      status: 401,
    });
  });

  it('throws BggResponseError when the body is not XML', async () => {
    stubResponses(xml('<items><item objectid="1">'));

    await expect(createClient().fetchCollection({ username: 'alice' })).rejects.toThrow(
      BggResponseError,
    );
  });

  it('throws BggResponseError when an item is missing its status', async () => {
    stubResponses(xml('<items totalitems="1"><item objectid="5"></item></items>'));

    await expect(createClient().fetchCollection({ username: 'alice' })).rejects.toThrow(
      BggResponseError,
    );
  });
});
