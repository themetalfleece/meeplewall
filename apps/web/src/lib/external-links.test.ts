import { describe, expect, it } from 'vitest';

import { externalLinks } from './external-links';

describe('externalLinks.bggGame', () => {
  it('links to the game on BGG', () => {
    expect(externalLinks.bggGame(13)).toBe('https://boardgamegeek.com/boardgame/13');
  });
});
