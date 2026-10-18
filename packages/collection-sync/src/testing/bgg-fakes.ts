import type { BggClient, BggGame, BggGameVersion } from '@board-games/boardgamegeek';

import type { CollectedGame, CollectionProvider } from '../collection-provider.ts';

/** A BGG game as the client returns it, with every optional field filled. */
export function bggGame({
  bggId,
  name,
  imageUrl = `https://cf.geekdo-images.com/${bggId}/original.jpg`,
}: {
  bggId: number;
  name: string;
  imageUrl?: string | null;
}): BggGame {
  return {
    bggId,
    name,
    yearPublished: 2020,
    players: { min: 1, max: 4 },
    playTime: { min: 30, max: 60 },
    minAge: 10,
    shortDescription: `${name} in one line`,
    description: `All about ${name}.`,
    imageUrl,
    thumbnailUrl: imageUrl === null ? null : `${imageUrl}.thumb`,
    designers: [],
    artists: [],
    publishers: [{ id: 1, name: 'Some Publisher' }],
    categories: [{ id: 2, name: 'Card Game' }],
    mechanics: [{ id: 3, name: 'Hand Management' }],
    families: [],
    stats: { averageRating: 7.5, ratingCount: 1_000, weight: 2.1, weightCount: 50, rank: 100 },
  };
}

/** One edition with dimensions in centimetres. */
export function measuredVersion({
  length,
  width,
  depth,
}: {
  length: number;
  width: number;
  depth: number;
}): BggGameVersion {
  return {
    versionId: 1,
    name: 'English edition',
    yearPublished: 2020,
    dimensions: { length, width, depth },
    publishers: [],
    languages: [],
  };
}

/** A BGG client that serves the given games and counts what it was asked for. */
export class FakeBggClient implements BggClient {
  readonly fetchedGameIds: number[] = [];
  readonly #games: Map<number, BggGame>;
  readonly #versions: BggGameVersion[];
  #failure: Error | undefined;

  constructor({ games, versions = [] }: { games: BggGame[]; versions?: BggGameVersion[] }) {
    this.#games = new Map(games.map((game) => [game.bggId, game]));
    this.#versions = versions;
  }

  /** Makes every later request throw `error`. */
  failWith(error: Error): void {
    this.#failure = error;
  }

  fetchGame({ bggId }: { bggId: number }): Promise<BggGame | null> {
    if (this.#failure !== undefined) {
      return Promise.reject(this.#failure);
    }
    this.fetchedGameIds.push(bggId);

    return Promise.resolve(this.#games.get(bggId) ?? null);
  }

  fetchGameVersions(): Promise<BggGameVersion[]> {
    return Promise.resolve(this.#versions);
  }
}

/** A provider that serves fixed collections, keyed by lower-cased username. */
export class FakeCollectionProvider implements CollectionProvider {
  readonly transport = 'geekdo';
  readonly #collections: Map<string, CollectedGame[]>;

  constructor({ collections }: { collections: Record<string, CollectedGame[]> }) {
    this.#collections = new Map(
      Object.entries(collections).map(([username, games]) => [username.toLowerCase(), games]),
    );
  }

  fetchCollection({ username }: { username: string }): Promise<CollectedGame[] | null> {
    return Promise.resolve(this.#collections.get(username.toLowerCase()) ?? null);
  }
}
