import { requestCollectionSync } from '@meeplewall/collection-sync';

import { jsonError, NO_STORE_HEADERS } from '@/lib/responses';
import { parseUsername, type UserRouteContext } from '@/lib/route-params';
import { getDatabase } from '@/lib/services';
import { toSyncStatus } from '@/lib/sync';

/**
 * Queues a manual refresh of a user's collection, at most one a minute per user. Answers 202
 * with the queued sync, 200 when one was already running, or 429 with `Retry-After`.
 */
export async function POST(_request: Request, { params }: UserRouteContext): Promise<Response> {
  const username = parseUsername((await params).uId);
  if (username === null) {
    return jsonError({ message: 'Invalid username', status: 400 });
  }

  const request = await requestCollectionSync(getDatabase(), { username, source: 'user' });
  const status = toSyncStatus({ sync: request.sync, now: new Date() });

  if (request.kind === 'throttled') {
    return Response.json(status, {
      status: 429,
      headers: { ...NO_STORE_HEADERS, 'Retry-After': String(request.retryAfterSeconds) },
    });
  }

  return Response.json(status, {
    status: request.kind === 'started' ? 202 : 200,
    headers: NO_STORE_HEADERS,
  });
}
