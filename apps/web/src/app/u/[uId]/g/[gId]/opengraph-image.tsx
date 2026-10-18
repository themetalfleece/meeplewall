import { parseGameId, parseUsername, type UserGameRouteProps } from '@/lib/route-params';

export const alt = 'A board game box from a BoardGameGeek collection';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

/** The game's cover and name, naming whose collection it is in. */
export default async function CollectionGameOpenGraphImage({ params }: UserGameRouteProps) {
  const { uId, gId } = await params;
  const bggId = parseGameId(gId);
  const [{ ImageResponse }, { GameOgImage }, { loadGame }] = await Promise.all([
    import('next/og'),
    import('@/components/OgImage'),
    import('@/lib/games'),
  ]);
  const game = bggId === null ? null : await loadGame({ bggId });

  return new ImageResponse(<GameOgImage game={game} collectionOf={parseUsername(uId)} />, size);
}
