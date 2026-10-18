import type { CSSProperties } from 'react';

import { BRAND_BACKGROUND_COLOR } from '@/lib/brand';

/** Social images are 1200 by 630, the size every major network crops to. */
export const OG_IMAGE_SIZE = { width: 1200, height: 630 };

/** Space between the image's edge and its content, on every side. */
export const OG_PADDING = 64;

/**
 * The site palette from globals.css. The social image renderer resolves no CSS custom
 * properties, so these are repeated here.
 */
export const OG_COLORS = {
  background: BRAND_BACKGROUND_COLOR,
  surface: '#1c1c1f',
  text: '#f4f1ea',
  muted: '#b7b2a8',
};

/** The full-bleed frame every social image draws inside. */
export const OG_FRAME_STYLE: CSSProperties = {
  display: 'flex',
  width: '100%',
  height: '100%',
  padding: OG_PADDING,
  background: OG_COLORS.background,
  color: OG_COLORS.text,
  fontFamily: 'Georgia, serif',
};

export const NOT_FOUND_GAME_NAME = 'Board game not found';
