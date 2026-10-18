import { getGameName } from '@meeplewall/db';

import { logError } from './logger';
import { gameSegment, parseGameId } from './route-params';
import { getDatabase } from './services';

/**
 * The canonical form of a `/g/[gId]` or `/u/[uId]/g/[gId]` path, or null when it already is
 * canonical, the id is invalid or the game is unknown. Those last two fall through to the page's
 * own not-found. A failed read falls through too, since the page can still render from its cache.
 */
export async function canonicalGamePath(pathname: string): Promise<string | null> {
  const segmentStart = pathname.lastIndexOf('/') + 1;
  const segment = pathname.slice(segmentStart);
  const bggId = parseGameId(segment);
  if (bggId === null) {
    return null;
  }

  const name = await readGameName(bggId);
  if (name === undefined) {
    return null;
  }

  const canonical = gameSegment({ bggId, name });

  return canonical === segment ? null : `${pathname.slice(0, segmentStart)}${canonical}`;
}

async function readGameName(bggId: number): Promise<string | undefined> {
  try {
    return await getGameName(getDatabase(), { bggId });
  } catch (error) {
    logError({
      message: 'Reading a game name for its canonical URL failed',
      error,
      fields: { bggId },
    });

    return undefined;
  }
}
