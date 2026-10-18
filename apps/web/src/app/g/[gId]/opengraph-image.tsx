import { OG_IMAGE_SIZE } from '@/components/OgImage/OgImage.constants';
import { parseGameId, type GameRouteProps } from '@/lib/route-params';

export const alt = 'A board game box, with its name';
export const size = OG_IMAGE_SIZE;
export const contentType = 'image/png';

/** The game's cover and name. The renderer and the read load only when an image is drawn. */
export default async function GameOpenGraphImage({ params }: GameRouteProps) {
  const bggId = parseGameId((await params).gId);
  const [{ ImageResponse }, { GameOgImage }, { loadGame }] = await Promise.all([
    import('next/og'),
    import('@/components/OgImage'),
    import('@/lib/games'),
  ]);
  const game = bggId === null ? null : await loadGame({ bggId });

  return new ImageResponse(<GameOgImage game={game} collectionOf={null} />, size);
}
