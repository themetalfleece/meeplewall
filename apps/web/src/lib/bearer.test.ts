import { describe, expect, it } from 'vitest';

import { hasBearerSecret } from './bearer';

const SECRET = 's'.repeat(40);

describe('hasBearerSecret', () => {
  it('accepts the exact secret', () => {
    expect(hasBearerSecret({ authorization: `Bearer ${SECRET}`, secret: SECRET })).toBe(true);
  });

  it.each([
    { label: 'no header', authorization: null },
    { label: 'an empty header', authorization: '' },
    { label: 'another scheme', authorization: `Basic ${SECRET}` },
    { label: 'a lower-case scheme', authorization: `bearer ${SECRET}` },
    { label: 'a wrong secret', authorization: `Bearer ${'x'.repeat(40)}` },
    { label: 'a prefix of the secret', authorization: `Bearer ${SECRET.slice(0, 20)}` },
    { label: 'the secret with extra characters', authorization: `Bearer ${SECRET}x` },
    { label: 'an empty token', authorization: 'Bearer ' },
  ])('rejects $label', ({ authorization }) => {
    expect(hasBearerSecret({ authorization, secret: SECRET })).toBe(false);
  });
});
