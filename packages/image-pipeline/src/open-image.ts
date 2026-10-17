import sharp, { type Sharp } from 'sharp';

/**
 * Decodes `input` upright, following its EXIF orientation. Aborts on a truncated
 * download but tolerates the minor warnings many real scans carry.
 */
export function openImage(input: Uint8Array): Sharp {
  return sharp(input, { autoOrient: true, failOn: 'truncated' });
}
