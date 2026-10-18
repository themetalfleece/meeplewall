import type { CollectionShelf } from '@meeplewall/db';
import { z } from 'zod';

import { MAIN_SHELF, shelfQuery } from './shelves';

/** BGG usernames are letters, digits, underscores and the odd space, dot or dash. */
const usernameSchema = z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9_][A-Za-z0-9_ .-]{0,49}$/);

/** A BGG id, optionally followed by a dash and a slug that is never read. */
const GAME_SEGMENT = /^([1-9][0-9]{0,8})(?:-.*)?$/;

/** Long enough to name any real game, short enough to keep a shared link readable. */
const SLUG_MAX_LENGTH = 60;

/** `segment` percent-decoded, or null when its escapes are malformed. */
export function decodeSegment(segment: string): string | null {
  try {
    return decodeURIComponent(segment);
  } catch {
    return null;
  }
}

/** `value` trimmed when it can be a BGG username, else null. */
export function validateUsername(value: string): string | null {
  const result = usernameSchema.safeParse(value);

  return result.success ? result.data : null;
}

/** The BGG username in a `[uId]` segment, or null when it cannot be one. */
export function parseUsername(segment: string): string | null {
  const decoded = decodeSegment(segment);

  return decoded === null ? null : validateUsername(decoded);
}

/**
 * The BGG game id in a `[gId]` segment such as `13` or `13-catan`, or null when it does not
 * start with a positive integer. The slug is ignored, so a stale one still finds the game.
 */
export function parseGameId(segment: string): number | null {
  const id = GAME_SEGMENT.exec(segment)?.[1];

  return id === undefined ? null : Number(id);
}

/** `name` as lowercase ASCII words joined by dashes, or empty when no letter or digit survives. */
export function gameSlug(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, SLUG_MAX_LENGTH)
    .replace(/^-+|-+$/g, '');
}

export interface GameLink {
  bggId: number;
  name: string;
}

/** The canonical `[gId]` segment for a game: `13-catan`, or just `13` when the slug is empty. */
export function gameSegment({ bggId, name }: GameLink): string {
  const slug = gameSlug(name);

  return slug === '' ? String(bggId) : `${bggId}-${slug}`;
}

/** Path helpers, so every link to a route is built one way. Fixed paths are functions too. */
export const routes = {
  collection: (username: string) => `/u/${encodeURIComponent(username)}`,
  collectionShelf: ({ username, shelf }: { username: string; shelf: CollectionShelf }) =>
    `/u/${encodeURIComponent(username)}${shelfQuery(shelf)}`,
  /** `shelf` picks the neighbours the game's page links to. */
  collectionGame: ({
    username,
    shelf = MAIN_SHELF,
    ...game
  }: GameLink & { username: string; shelf?: CollectionShelf }) =>
    `/u/${encodeURIComponent(username)}/g/${gameSegment(game)}${shelfQuery(shelf)}`,
  game: (game: GameLink) => `/g/${gameSegment(game)}`,
  syncStatus: (username: string) => `/api/sync/${encodeURIComponent(username)}`,
  refresh: (username: string) => `/api/refresh/${encodeURIComponent(username)}`,
  about: () => '/about',
  privacy: () => '/privacy',
} satisfies Record<string, (...args: never[]) => string>;

/** The props Next.js passes each route. Params arrive still encoded and as a promise. */
export interface UserRouteProps {
  params: Promise<{ uId: string }>;
}

export interface GameRouteProps {
  params: Promise<{ gId: string }>;
}

export interface UserGameRouteProps {
  params: Promise<{ uId: string; gId: string }>;
}

/** The query a page receives, as a promise like its params. */
export interface RouteSearchParams {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/** What a route handler's second argument carries. */
export interface UserRouteContext {
  params: Promise<{ uId: string }>;
}
