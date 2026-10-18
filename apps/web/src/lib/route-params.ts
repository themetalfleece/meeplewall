import { z } from 'zod';

/** BGG usernames are letters, digits, underscores and the odd space, dot or dash. */
const usernameSchema = z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9_][A-Za-z0-9_ .-]{0,49}$/);

const bggIdSchema = z
  .string()
  .regex(/^[1-9][0-9]{0,8}$/)
  .transform(Number);

function decodeSegment(segment: string): string | null {
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

/** The BGG game id in a `[gId]` segment, or null when it is not a positive integer. */
export function parseGameId(segment: string): number | null {
  const result = bggIdSchema.safeParse(segment);

  return result.success ? result.data : null;
}

/** Path helpers, so every link to a route is built one way. Fixed paths are functions too. */
export const routes = {
  collection: (username: string) => `/u/${encodeURIComponent(username)}`,
  collectionGame: ({ username, bggId }: { username: string; bggId: number }) =>
    `/u/${encodeURIComponent(username)}/g/${bggId}`,
  game: (bggId: number) => `/g/${bggId}`,
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

/** What a route handler's second argument carries. */
export interface UserRouteContext {
  params: Promise<{ uId: string }>;
}
