import { parseGameId, type GameRouteProps } from '@/lib/route-params';

export const alt = 'A board game box, with its name';
export const size = { width: 1200, height: 630 };
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
