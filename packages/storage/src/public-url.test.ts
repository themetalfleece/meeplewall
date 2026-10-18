import { describe, expect, it } from 'vitest';

import { publicObjectUrl } from './public-url.js';

describe('publicObjectUrl', () => {
  it('joins the base and key, encoding each segment but not the slashes', () => {
    expect(
      publicObjectUrl({ publicBaseUrl: 'https://cdn.example.com', key: 'covers/a b#1.webp' }),
    ).toBe('https://cdn.example.com/covers/a%20b%231.webp');
  });

  it('drops trailing slashes from the base', () => {
    expect(publicObjectUrl({ publicBaseUrl: 'http://localhost:9000/bucket//', key: 'k' })).toBe(
      'http://localhost:9000/bucket/k',
    );
  });
});
