import { getLatestCollectionSync } from '@meeplewall/db';

import { jsonError, NO_STORE_HEADERS } from '@/lib/responses';
import { parseUsername, type UserRouteContext } from '@/lib/route-params';
import { getDatabase } from '@/lib/services';
import { toSyncStatus } from '@/lib/sync';

/** One read of a user's latest sync, for the page that polls while it runs. */
export async function GET(_request: Request, { params }: UserRouteContext): Promise<Response> {
  const username = parseUsername((await params).uId);
  if (username === null) {
    return jsonError({ message: 'Invalid username', status: 400 });
  }

  const sync = await getLatestCollectionSync(getDatabase(), { username });

  return Response.json(toSyncStatus({ sync, now: new Date() }), { headers: NO_STORE_HEADERS });
}
