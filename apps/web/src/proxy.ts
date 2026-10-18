import { NextResponse, type NextRequest } from 'next/server';

import { canonicalGamePath } from '@/lib/game-redirect';

/**
 * Sends a game URL with a missing or stale slug to its canonical form. This runs before the page
 * renders: once its shell has streamed, a redirect can no longer be a 308.
 */
export async function proxy(request: NextRequest): Promise<NextResponse> {
  const pathname = await canonicalGamePath(request.nextUrl.pathname);
  if (pathname === null) {
    return NextResponse.next();
  }

  const location = request.nextUrl.clone();
  location.pathname = pathname;

  return NextResponse.redirect(location, 308);
}

export const config = {
  matcher: ['/g/:gId', '/u/:uId/g/:gId'],
};
