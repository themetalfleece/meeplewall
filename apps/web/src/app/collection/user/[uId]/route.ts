import { decodeSegment, routes, type UserRouteContext } from '@/lib/route-params';

/**
 * BGG's collection path, so swapping `boardgamegeek` for `meeplewall` in a link lands on the shelf.
 * The name is not validated here: an invalid one gets the shelf's own not-found page.
 * A trailing slash takes two hops, since Next's own 308 strips it before this runs.
 */
export async function GET(_request: Request, { params }: UserRouteContext): Promise<Response> {
  const segment = (await params).uId;
  const location = routes.collection(decodeSegment(segment) ?? segment);

  return new Response(null, { status: 308, headers: { Location: location } });
}
