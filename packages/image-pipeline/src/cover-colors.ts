import sharp, { type ChannelStats } from 'sharp';

import { openImage } from './open-image.ts';

/** A colour with 0 to 255 channels, possibly fractional. */
interface RgbColor {
  red: number;
  green: number;
  blue: number;
}

/** The colours a box's undecorated faces are painted with, as `#rrggbb`. */
export interface CoverColors {
  /** The cover's representative colour. */
  sideColor: string;
  /** A darker shade of `sideColor`, for the box edges. */
  edgeColor: string;
}

// Only the middle of the cover is sampled: scans often sit on a white background or carry a
// black border that would otherwise win the histogram.
const CENTER_FRACTION = 0.6;
const EDGE_DARKENING = 0.4;
// Used when the sampled colours are all near white or near black.
const NEUTRAL_SLATE: RgbColor = { red: 90, green: 92, blue: 98 };

function centerRegion({ width, height }: { width: number; height: number }) {
  const regionWidth = Math.max(1, Math.round(width * CENTER_FRACTION));
  const regionHeight = Math.max(1, Math.round(height * CENTER_FRACTION));

  return {
    left: Math.round((width - regionWidth) / 2),
    top: Math.round((height - regionHeight) / 2),
    width: regionWidth,
    height: regionHeight,
  };
}

function averageColor(channels: ChannelStats[]): RgbColor {
  const [red, green, blue] = channels;
  if (red === undefined || green === undefined || blue === undefined) {
    throw new Error(`Expected three colour channels, got ${channels.length}`);
  }

  return { red: red.mean, green: green.mean, blue: blue.mean };
}

function isNearWhiteOrBlack({ red, green, blue }: RgbColor): boolean {
  const nearWhite = red > 238 && green > 238 && blue > 238;
  const nearBlack = red < 16 && green < 16 && blue < 16;

  return nearWhite || nearBlack;
}

/** The first candidate that is not near white or near black, else a neutral slate. */
function pickSideColor(candidates: RgbColor[]): RgbColor {
  const usable = candidates.find((candidate) => !isNearWhiteOrBlack(candidate));
  if (usable === undefined) {
    return NEUTRAL_SLATE;
  }

  return usable;
}

function darken({ color, fraction }: { color: RgbColor; fraction: number }): RgbColor {
  const keep = 1 - fraction;

  return { red: color.red * keep, green: color.green * keep, blue: color.blue * keep };
}

function toHexChannel(value: number): string {
  const clamped = Math.max(0, Math.min(255, Math.round(value)));

  return clamped.toString(16).padStart(2, '0');
}

function toHex({ red, green, blue }: RgbColor): string {
  return `#${toHexChannel(red)}${toHexChannel(green)}${toHexChannel(blue)}`;
}

/**
 * Samples a cover's side and edge colours from the middle of the art. The side
 * colour is the dominant colour there, falling back to the average when the
 * dominant is a near-white or near-black background.
 */
export async function sampleCoverColors({ input }: { input: Uint8Array }): Promise<CoverColors> {
  const image = openImage(input);
  const { autoOrient } = await image.metadata();
  // stats() reads the decoded input and ignores every queued operation, so the centre is
  // rendered to pixels first. Flattening keeps transparent pixels from counting as their hidden
  // colour, and sRGB gives greyscale input three channels.
  const center = await image
    .flatten({ background: '#ffffff' })
    .extract(centerRegion(autoOrient))
    .toColourspace('srgb')
    .raw()
    .toBuffer({ resolveWithObject: true });
  const statistics = await sharp(center.data, {
    raw: { width: center.info.width, height: center.info.height, channels: center.info.channels },
  }).stats();

  const dominant = {
    red: statistics.dominant.r,
    green: statistics.dominant.g,
    blue: statistics.dominant.b,
  };
  const sideColor = pickSideColor([dominant, averageColor(statistics.channels)]);

  return {
    sideColor: toHex(sideColor),
    edgeColor: toHex(darken({ color: sideColor, fraction: EDGE_DARKENING })),
  };
}
