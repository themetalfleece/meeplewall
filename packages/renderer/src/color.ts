/** An 8-bit sRGB colour as red, green and blue bytes. */
export type RgbBytes = [red: number, green: number, blue: number];

const SHORT_HEX = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i;
const LONG_HEX = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i;

/** Parses `#rgb` or `#rrggbb`. Throws on anything else, so a bad sampled colour fails loudly. */
export function parseHexColor(hex: string): RgbBytes {
  const trimmed = hex.trim();

  const long = LONG_HEX.exec(trimmed);
  if (long) return [hexByte(long[1]), hexByte(long[2]), hexByte(long[3])];

  const short = SHORT_HEX.exec(trimmed);
  if (short) {
    return [
      hexByte(short[1]?.repeat(2)),
      hexByte(short[2]?.repeat(2)),
      hexByte(short[3]?.repeat(2)),
    ];
  }

  throw new SyntaxError(`Expected a #rgb or #rrggbb colour, got "${hex}"`);
}

function hexByte(digits: string | undefined): number {
  return Number.parseInt(digits ?? '0', 16);
}
