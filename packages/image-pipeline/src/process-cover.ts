import { sampleCoverColors, type CoverColors } from './cover-colors.ts';
import { openImage } from './open-image.ts';

/** One encoded size of an image. */
export interface EncodedImage {
  data: Buffer;
  contentType: 'image/webp';
  width: number;
  height: number;
}

/** Everything the gallery needs from one cover. */
export interface ProcessedCover extends CoverColors {
  /** The box's front face, long side at most 1024. */
  cover: EncodedImage;
  /** The 2D fallback, long side at most 320. */
  thumb: EncodedImage;
}

const COVER = { longSide: 1024, quality: 82 };
const THUMB = { longSide: 320, quality: 72 };
const WEBP_EFFORT = 4;

/** Scales the image to fit `longSide` without enlarging a smaller one, then encodes it as WebP. */
async function encodeWebp({
  input,
  longSide,
  quality,
}: {
  input: Uint8Array;
  longSide: number;
  quality: number;
}): Promise<EncodedImage> {
  const { data, info } = await openImage(input)
    .resize({ width: longSide, height: longSide, fit: 'inside', withoutEnlargement: true })
    .webp({ quality, effort: WEBP_EFFORT })
    .toBuffer({ resolveWithObject: true });

  return { data, contentType: 'image/webp', width: info.width, height: info.height };
}

/**
 * Turns a downloaded cover into its render-ready sizes and box colours. Only
 * resizes and re-encodes: the front cover is the colour reference every other
 * face is matched to, so it is never colour-corrected.
 *
 * @throws Error when `input` is not a decodable image, or is truncated.
 */
export async function processCover({ input }: { input: Uint8Array }): Promise<ProcessedCover> {
  const [cover, thumb, colors] = await Promise.all([
    encodeWebp({ input, ...COVER }),
    encodeWebp({ input, ...THUMB }),
    sampleCoverColors({ input }),
  ]);

  return { cover, thumb, ...colors };
}
