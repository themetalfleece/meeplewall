import { z } from 'zod';

import { PoliteHttpClient, politeHttpClientOptionsSchema } from './http.ts';
import {
  gameItemResponseSchema,
  gameStatsResponseSchema,
  gameVersionsPageResponseSchema,
} from './schemas.ts';
import type { BggGameItem, BggGameStats, BggGameVersion } from './schemas.ts';

const GEEKDO_API_BASE_URL = 'https://api.geekdo.com/api/';

/** geekdo returns at most 50 versions per page, whatever `showcount` asks for. */
const VERSIONS_PAGE_SIZE = 50;

/** Stops a misbehaving `numitems` from paging forever. The most-versioned games have a few hundred. */
const MAX_VERSION_PAGES = 40;

export type BggGame = BggGameItem & { stats: BggGameStats | null };

/**
 * Everything the app reads from BGG. The geekdo JSON API is the only implementation; another
 * transport, such as XMLAPI2, would implement this same interface.
 */
export type BggClient = {
  /** Metadata and rating stats for one game, or null when BGG has no game with that id. */
  fetchGame(options: { bggId: number }): Promise<BggGame | null>;
  /** Every published version (edition) of a game, with its physical dimensions where known. */
  fetchGameVersions(options: { bggId: number }): Promise<BggGameVersion[]>;
};

export type BggClientOptions = z.input<typeof politeHttpClientOptionsSchema>;

const bggIdSchema = z.number().int().positive();

function parseBggId(bggId: number): number {
  const result = bggIdSchema.safeParse(bggId);

  if (!result.success) {
    throw new RangeError(`A BGG id must be a positive integer, got ${bggId}`);
  }

  return result.data;
}

/** The query naming one game, which every geekdo endpoint we call starts with. */
function thingQuery(bggId: number): Record<string, string> {
  return { objectid: String(parseBggId(bggId)), objecttype: 'thing' };
}

function geekdoUrl({ path, query }: { path: string; query: Record<string, string> }): string {
  const url = new URL(path, GEEKDO_API_BASE_URL);
  url.search = new URLSearchParams(query).toString();

  return url.toString();
}

class GeekdoClient implements BggClient {
  readonly #http: PoliteHttpClient;

  constructor({ http }: { http: PoliteHttpClient }) {
    this.#http = http;
  }

  async fetchGame({ bggId }: { bggId: number }): Promise<BggGame | null> {
    const objectQuery = thingQuery(bggId);
    // Sequential on purpose: the throttle serialises the two requests anyway, and an unknown id
    // then costs one request instead of two.
    const item = await this.#http.getJson({
      url: geekdoUrl({ path: 'geekitems', query: objectQuery }),
      schema: gameItemResponseSchema,
    });

    if (item === null) {
      return null;
    }

    const stats = await this.#http.getJson({
      url: geekdoUrl({ path: 'dynamicinfo', query: objectQuery }),
      schema: gameStatsResponseSchema,
    });

    return { ...item, stats };
  }

  async fetchGameVersions({ bggId }: { bggId: number }): Promise<BggGameVersion[]> {
    const objectQuery = thingQuery(bggId);
    const versions: BggGameVersion[] = [];

    for (let page = 1; page <= MAX_VERSION_PAGES; page += 1) {
      const result = await this.#http.getJson({
        url: geekdoUrl({
          path: 'geekitem/linkeditems',
          query: {
            ...objectQuery,
            linkdata_index: 'boardgameversion',
            subtype: 'boardgameversion',
            sort: 'yearpublished',
            showcount: String(VERSIONS_PAGE_SIZE),
            pageid: String(page),
          },
        }),
        schema: gameVersionsPageResponseSchema,
      });

      if (result === null) {
        return versions;
      }

      versions.push(...result.versions);

      const isLastPage = result.versions.length < VERSIONS_PAGE_SIZE;
      const hasEverything = result.totalCount !== null && versions.length >= result.totalCount;

      if (isLastPage || hasEverything) {
        return versions;
      }
    }

    return versions;
  }
}

/**
 * Creates a BGG client over the geekdo JSON API. `userAgent` identifies the app to BGG (the app
 * reads it from `BGG_USER_AGENT`); `requestsPerSecond` is a hard cap shared by every call made
 * through this client. Throws, naming each field, when an option is missing or invalid.
 */
export function createBggClient(options: BggClientOptions): BggClient {
  const result = politeHttpClientOptionsSchema.safeParse(options);

  if (!result.success) {
    throw new TypeError(`Invalid BGG client options:\n${z.prettifyError(result.error)}`);
  }

  return new GeekdoClient({ http: new PoliteHttpClient(result.data) });
}
