import { describe, expect, it } from 'vitest';
import { parseHexColor } from './color.js';

describe('parseHexColor', () => {
  it('parses a six-digit colour', () => {
    expect(parseHexColor('#182828')).toEqual([0x18, 0x28, 0x28]);
  });

  it('parses a three-digit colour by doubling each digit', () => {
    expect(parseHexColor('#0af')).toEqual([0x00, 0xaa, 0xff]);
  });

  it('ignores case and surrounding whitespace', () => {
    expect(parseHexColor('  #FFfFff ')).toEqual([255, 255, 255]);
  });

  it.each(['', '182828', '#18282', '#1828280', '#ggg', 'rgb(0, 0, 0)', 'teal'])(
    'rejects "%s"',
    (input) => {
      expect(() => parseHexColor(input)).toThrow(SyntaxError);
    },
  );
});
