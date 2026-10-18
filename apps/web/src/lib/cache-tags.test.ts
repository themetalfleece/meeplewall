import { describe, expect, it } from 'vitest';

import { gameCacheTag } from './cache-tags';

describe('gameCacheTag', () => {
  it('gives each game its own tag', () => {
    expect(gameCacheTag(13)).toBe('game:13');
    expect(gameCacheTag(13)).not.toBe(gameCacheTag(130));
  });
});
