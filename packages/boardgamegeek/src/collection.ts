import { XMLParser } from 'fast-xml-parser';
import { z } from 'zod';

import { BggHttpError, BggResponseError, PoliteHttpClient, sleep } from './http.ts';

const COLLECTION_URL = 'https://boardgamegeek.com/xmlapi2/collection';

/**
 * BGG answers 202 while it builds a collection it has not cached, and the same request succeeds
 * once it is ready. Large collections take tens of seconds, so the wait grows from two seconds
 * to ten, for about two minutes in all.
 */
const MAX_QUEUED_ATTEMPTS = 15;
const INITIAL_QUEUED_DELAY_MS = 2_000;
const MAX_QUEUED_DELAY_MS = 10_000;

/** One game in a user's collection, with that user's own status flags and rating. */
export type BggCollectionItem = z.output<typeof collectionItemSchema>;

/** Reads whole collections over XMLAPI2, the only BGG API that lists one. */
export type BggCollectionClient = {
  readonly transport: 'xmlapi2';
  /**
   * The base games in a user's collection with at least one status flag set, one entry per game
   * and expansions excluded, or null when BGG has no user with that name.
   */
  fetchCollection(options: { username: string }): Promise<BggCollectionItem[] | null>;
};

const flagSchema = z.union([z.string(), z.number()]).transform((value) => String(value) === '1');

/** `N/A` until the user rates the game. */
const ratingSchema = z
  .union([z.string(), z.number()])
  .transform((value) => Number(value))
  .transform((value) => (Number.isFinite(value) && value > 0 ? value : null));

/** 1 (must have) to 5 (don't buy this) on wishlist games. Anything else reads as unknown. */
const wishlistPrioritySchema = z
  .union([z.string(), z.number()])
  .optional()
  .transform((value) => Number(value))
  .transform((value) => (Number.isInteger(value) && value >= 1 && value <= 5 ? value : null));

const collectionItemSchema = z
  .object({
    objectid: z.union([z.number(), z.string()]).transform(Number).pipe(z.number().int().positive()),
    status: z.object({
      own: flagSchema,
      prevowned: flagSchema,
      fortrade: flagSchema,
      want: flagSchema,
      wanttoplay: flagSchema,
      wanttobuy: flagSchema,
      wishlist: flagSchema,
      wishlistpriority: wishlistPrioritySchema,
      preordered: flagSchema,
    }),
    stats: z.object({ rating: z.object({ value: ratingSchema }) }).optional(),
  })
  .transform(({ objectid, status, stats }) => ({
    bggId: objectid,
    owned: status.own,
    previouslyOwned: status.prevowned,
    forTrade: status.fortrade,
    wantInTrade: status.want,
    wantToPlay: status.wanttoplay,
    wantToBuy: status.wanttobuy,
    wishlist: status.wishlist,
    wishlistPriority: status.wishlist ? status.wishlistpriority : null,
    preordered: status.preordered,
    /** The user's rating out of 10, or null when they have not rated it. */
    userRating: stats === undefined ? null : stats.rating.value,
  }));

const STATUS_FLAGS = [
  'owned',
  'previouslyOwned',
  'forTrade',
  'wantInTrade',
  'wantToPlay',
  'wantToBuy',
  'wishlist',
  'preordered',
] as const satisfies readonly (keyof BggCollectionItem)[];

function hasAnyStatus(item: BggCollectionItem): boolean {
  return STATUS_FLAGS.some((flag) => item[flag]);
}

/** Folds two entries for one game into one: any flag set on either, and the first known rating. */
function mergeEntries({
  first,
  second,
}: {
  first: BggCollectionItem;
  second: BggCollectionItem;
}): BggCollectionItem {
  const merged = { ...first };
  for (const flag of STATUS_FLAGS) {
    merged[flag] = first[flag] || second[flag];
  }
  if (merged.wishlistPriority === null) {
    merged.wishlistPriority = second.wishlistPriority;
  }
  if (merged.userRating === null) {
    merged.userRating = second.userRating;
  }

  return merged;
}

/**
 * One entry per game, in first-seen order. BGG lists a game once per copy, so a user can have it
 * owned once and wishlisted again.
 */
function mergeByGame(items: BggCollectionItem[]): BggCollectionItem[] {
  const byGame = new Map<number, BggCollectionItem>();
  for (const item of items) {
    const seen = byGame.get(item.bggId);
    byGame.set(item.bggId, seen === undefined ? item : mergeEntries({ first: seen, second: item }));
  }

  return [...byGame.values()];
}

const collectionDocumentSchema = z.union([
  z.object({
    items: z.union([
      z.object({ item: z.array(collectionItemSchema).default([]) }),
      // An empty collection parses to an empty string when the element has no attributes.
      z.literal('').transform(() => ({ item: [] })),
    ]),
  }),
  z.object({
    errors: z.object({ error: z.array(z.object({ message: z.string() })) }),
  }),
]);

const collectionOptionsSchema = z.object({
  userAgent: z.string().trim().min(1),
  token: z.string().trim().min(1),
  requestsPerSecond: z.number().positive().max(10),
});

export type BggCollectionClientOptions = z.input<typeof collectionOptionsSchema>;

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '',
  isArray: (name) => name === 'item' || name === 'error',
});

function parseXml({ url, text }: { url: string; text: string }): unknown {
  try {
    const document: unknown = xmlParser.parse(text, true);

    return document;
  } catch {
    throw new BggResponseError({ url, reason: 'the body is not XML' });
  }
}

class XmlApiCollectionClient implements BggCollectionClient {
  readonly transport = 'xmlapi2';
  readonly #http: PoliteHttpClient;
  readonly #token: string;

  constructor({ http, token }: { http: PoliteHttpClient; token: string }) {
    this.#http = http;
    this.#token = token;
  }

  async fetchCollection({ username }: { username: string }): Promise<BggCollectionItem[] | null> {
    const url = XmlApiCollectionClient.#collectionUrl(username);

    for (let attempt = 1; attempt <= MAX_QUEUED_ATTEMPTS; attempt += 1) {
      const response = await this.#http.get({
        url,
        headers: { Accept: 'application/xml', Authorization: `Bearer ${this.#token}` },
      });

      if (response.status !== 202) {
        return XmlApiCollectionClient.#read({ url, response });
      }

      await response.body?.cancel();
      await sleep(Math.min(INITIAL_QUEUED_DELAY_MS * attempt, MAX_QUEUED_DELAY_MS));
    }

    throw new BggHttpError({ status: 202, url });
  }

  static #collectionUrl(username: string): string {
    const url = new URL(COLLECTION_URL);
    url.search = new URLSearchParams({
      username,
      subtype: 'boardgame',
      // `subtype=boardgame` alone still lists owned expansions.
      excludesubtype: 'boardgameexpansion',
      stats: '1',
    }).toString();

    return url.toString();
  }

  static async #read({
    url,
    response,
  }: {
    url: string;
    response: Response;
  }): Promise<BggCollectionItem[] | null> {
    if (!response.ok) {
      await response.body?.cancel();

      throw new BggHttpError({ status: response.status, url });
    }

    const result = collectionDocumentSchema.safeParse(
      parseXml({ url, text: await response.text() }),
    );
    if (!result.success) {
      throw new BggResponseError({ url, reason: z.prettifyError(result.error) });
    }
    if ('errors' in result.data) {
      return XmlApiCollectionClient.#readErrors({ url, errors: result.data.errors.error });
    }

    // Entries with no flag set are games the user only rated, commented on or logged plays of.
    return mergeByGame(result.data.items.item.filter(hasAnyStatus));
  }

  /** BGG reports an unknown user as a 200 with an error message instead of a 404. */
  static #readErrors({ url, errors }: { url: string; errors: { message: string }[] }): null {
    const messages = errors.map((error) => error.message);
    if (messages.some((message) => /invalid username/i.test(message))) {
      return null;
    }

    throw new BggResponseError({ url, reason: messages.join('; ') });
  }
}

/**
 * Creates a client for BGG's XMLAPI2 collection endpoint. `token` is the bearer token of an
 * application registered with BGG (the app reads it from `BGG_API_TOKEN`). Throws, naming each
 * field, when an option is missing or invalid.
 */
export function createBggCollectionClient(
  options: BggCollectionClientOptions,
): BggCollectionClient {
  const result = collectionOptionsSchema.safeParse(options);

  if (!result.success) {
    throw new TypeError(`Invalid BGG collection client options:\n${z.prettifyError(result.error)}`);
  }

  const { userAgent, token, requestsPerSecond } = result.data;

  return new XmlApiCollectionClient({
    http: new PoliteHttpClient({ userAgent, requestsPerSecond }),
    token,
  });
}
