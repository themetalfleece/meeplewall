import { revalidateTag } from 'next/cache';
import { z } from 'zod';

import { hasBearerSecret } from '@/lib/bearer';
import { gameCacheTag } from '@/lib/cache-tags';
import { internalRevalidateSecret } from '@/lib/env';
import { jsonError, NO_STORE_HEADERS } from '@/lib/responses';

const revalidateBodySchema = z.object({ bggGameId: z.number().int().positive() });

async function readBody(request: Request): Promise<unknown> {
  try {
    const body: unknown = await request.json();
    return body;
  } catch {
    return undefined;
  }
}

/**
 * Called by the image processor once a game's image is stored, with the shared secret as a
 * bearer token. Expires the game's cached reads, so both game routes pick up the new cover on
 * their next request. Collection pages read per request and need nothing.
 */
export async function POST(request: Request): Promise<Response> {
  const authorized = hasBearerSecret({
    authorization: request.headers.get('authorization'),
    secret: internalRevalidateSecret(),
  });
  if (!authorized) {
    return jsonError({ message: 'Unauthorized', status: 401 });
  }

  const body = revalidateBodySchema.safeParse(await readBody(request));
  if (!body.success) {
    return jsonError({ message: 'Expected { "bggGameId": <positive integer> }', status: 400 });
  }

  revalidateTag(gameCacheTag(body.data.bggGameId), { expire: 0 });

  return Response.json({ revalidated: true }, { headers: NO_STORE_HEADERS });
}
