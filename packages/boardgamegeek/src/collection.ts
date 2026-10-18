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

/** One game in a user's collection, with that user's own flags and rating. */
export type BggCollectionItem = {
  bggId: number;
  owned: boolean;
  wantToPlay: boolean;
  /** The user's rating out of 10, or null when they have not rated it. */
  userRating: number | null;
};

/** Reads whole collections over XMLAPI2, the only BGG API that lists one. */
export type BggCollectionClient = {
  readonly transport: 'xmlapi2';
  /**
   * The base games a user owns or wants to play, expansions excluded, or null when BGG has no
   * user with that name.
   */
  fetchCollection(options: { username: string }): Promise<BggCollectionItem[] | null>;
};

const flagSchema = z.union([z.string(), z.number()]).transform((value) => String(value) === '1');

/** `N/A` until the user rates the game. */
const ratingSchema = z
  .union([z.string(), z.number()])
  .transform((value) => Number(value))
  .transform((value) => (Number.isFinite(value) && value > 0 ? value : null));

const collectionItemSchema = z
  .object({
    objectid: z.union([z.number(), z.string()]).transform(Number).pipe(z.number().int().positive()),
    status: z.object({ own: flagSchema, wanttoplay: flagSchema }),
    stats: z.object({ rating: z.object({ value: ratingSchema }) }).optional(),
  })
  .transform((item) => ({
    bggId: item.objectid,
    owned: item.status.own,
    wantToPlay: item.status.wanttoplay,
    userRating: item.stats === undefined ? null : item.stats.rating.value,
  }));

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

    return result.data.items.item.filter((item) => item.owned || item.wantToPlay);
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
