import { OG_IMAGE_SIZE } from '@/components/OgImage/OgImage.constants';
import { parseGameId, parseUsername, type UserGameRouteProps } from '@/lib/route-params';

export const alt = 'A board game box from a BoardGameGeek collection';
export const size = OG_IMAGE_SIZE;
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
