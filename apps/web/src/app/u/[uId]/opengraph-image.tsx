import { parseUsername, type UserRouteProps } from '@/lib/route-params';

export const alt = 'A BoardGameGeek collection, as a row of box covers';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

/** The collection owner's name over a few covers. Reads only, so sharing never starts a sync. */
export default async function CollectionOpenGraphImage({ params }: UserRouteProps) {
  const username = parseUsername((await params).uId);
  const [{ ImageResponse }, { CollectionOgImage }, { loadCollectionSummary }] = await Promise.all([
    import('next/og'),
    import('@/components/OgImage'),
    import('@/lib/collections'),
  ]);
  const summary = username === null ? null : await loadCollectionSummary({ username });

  return new ImageResponse(<CollectionOgImage summary={summary} username={username} />, size);
}
