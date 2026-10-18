import type { BggGame, ImageAsset } from '@board-games/db';
import type { GameBoxInput } from '@board-games/renderer';
import { publicObjectUrl } from '@board-games/storage';

/** A square box of a common size, for games whose editions list no dimensions. */
const FALLBACK_BOX_MM = { width: 296, height: 296, depth: 72 };

/**
 * Box fills until the image processor samples the real cover colours. WebGL needs hex colours,
 * so these cannot come from the stylesheet.
 */
const FALLBACK_SIDE_COLOR = '#2a2a2e';
const FALLBACK_EDGE_COLOR = '#1a1a1d';

/**
 * A same-origin flat front for the 3D box until the processed cover exists. BGG's image CDN
 * sends no CORS headers, so a raw BGG URL cannot be a WebGL texture.
 */
export const PLACEHOLDER_COVER_PATH = '/placeholder-cover.png';

/** Where a game's images come from right now. */
export interface GameImages {
  /** The best cover to show in an `<img>`: the processed one, else BGG's original. */
  coverUrl: string | null;
  /** The best small image for a grid card: the processed thumb, else BGG's. */
  thumbUrl: string | null;
  /** The processed cover only, the one image the 3D box can load across origins. */
  processedCoverUrl: string | null;
  /** BGG's original upload. Social images use it, since their renderer cannot read WebP. */
  originalUrl: string | null;
  sideColor: string | null;
  edgeColor: string | null;
}

function assetOfKind({ assets, kind }: { assets: ImageAsset[]; kind: ImageAsset['kind'] }) {
  return assets.find((asset) => asset.kind === kind);
}

function firstPresent(candidates: (string | null | undefined)[]): string | null {
  return candidates.find((candidate) => typeof candidate === 'string') ?? null;
}

/** Picks a game's images from its processed assets, falling back to BGG's own URLs. */
export function resolveGameImages({
  game,
  assets,
  publicBaseUrl,
}: {
  game: Pick<BggGame, 'imageUrlRaw' | 'thumbUrlRaw'>;
  assets: ImageAsset[];
  publicBaseUrl: string;
}): GameImages {
  const cover = assetOfKind({ assets, kind: 'cover' });
  const thumb = assetOfKind({ assets, kind: 'thumb' });
  const processedCoverUrl =
    cover === undefined ? null : publicObjectUrl({ publicBaseUrl, key: cover.storageKey });
  const processedThumbUrl =
    thumb === undefined ? null : publicObjectUrl({ publicBaseUrl, key: thumb.storageKey });

  return {
    coverUrl: firstPresent([processedCoverUrl, game.imageUrlRaw]),
    thumbUrl: firstPresent([processedThumbUrl, game.thumbUrlRaw, processedCoverUrl]),
    processedCoverUrl,
    originalUrl: game.imageUrlRaw,
    sideColor: firstPresent([cover?.sideColor, thumb?.sideColor]),
    edgeColor: firstPresent([cover?.edgeColor, thumb?.edgeColor]),
  };
}

function measuredSize(
  game: Pick<BggGame, 'boxWidthMm' | 'boxHeightMm' | 'boxDepthMm'>,
): GameBoxInput['size'] | null {
  const { boxWidthMm, boxHeightMm, boxDepthMm } = game;
  if (boxWidthMm === null || boxHeightMm === null || boxDepthMm === null) {
    return null;
  }

  return { width: boxWidthMm, height: boxHeightMm, depth: boxDepthMm };
}

/** Everything the renderer needs, with fallbacks for a game not yet measured or processed. */
export function toGameBoxInput({
  game,
  images,
}: {
  game: Pick<BggGame, 'boxWidthMm' | 'boxHeightMm' | 'boxDepthMm'>;
  images: GameImages;
}): GameBoxInput {
  return {
    size: measuredSize(game) ?? FALLBACK_BOX_MM,
    covers: { front: images.processedCoverUrl ?? PLACEHOLDER_COVER_PATH },
    sideColor: images.sideColor ?? FALLBACK_SIDE_COLOR,
    edgeColor: images.edgeColor ?? FALLBACK_EDGE_COLOR,
  };
}
