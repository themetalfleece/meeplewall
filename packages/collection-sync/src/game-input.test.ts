import { describe, expect, it } from 'vitest';

import { toGameInput } from './game-input.ts';
import { bggGame, measuredVersion } from './testing/bgg-fakes.ts';

describe('toGameInput', () => {
  it('maps a full BGG game onto the stored row', () => {
    const game = bggGame({ bggId: 42, name: 'Example' });

    expect(toGameInput({ game, versions: [] })).toEqual({
      id: 42,
      name: 'Example',
      year: 2020,
      description: 'All about Example.',
      minPlayers: 1,
      maxPlayers: 4,
      minPlayTime: 30,
      maxPlayTime: 60,
      weight: 2.1,
      averageRating: 7.5,
      ratingCount: 1_000,
      categories: ['Card Game'],
      mechanics: ['Hand Management'],
      publisher: 'Some Publisher',
      imageUrlRaw: 'https://cf.geekdo-images.com/42/original.jpg',
      thumbUrlRaw: 'https://cf.geekdo-images.com/42/original.jpg.thumb',
      boxWidthMm: null,
      boxHeightMm: null,
      boxDepthMm: null,
    });
  });

  it('stores the cross-checked box in whole millimetres', () => {
    const game = bggGame({ bggId: 42, name: 'Example' });

    const input = toGameInput({
      game,
      versions: [measuredVersion({ length: 29.55, width: 22.1, depth: 7 })],
    });

    expect(input).toMatchObject({ boxHeightMm: 296, boxWidthMm: 221, boxDepthMm: 70 });
  });

  it('leaves the rating fields empty when BGG returned no stats', () => {
    const game = { ...bggGame({ bggId: 42, name: 'Example' }), stats: null };

    expect(toGameInput({ game, versions: [] })).toMatchObject({
      weight: null,
      averageRating: null,
      ratingCount: null,
    });
  });

  it('stores no description, publisher or image when BGG has none', () => {
    const game = {
      ...bggGame({ bggId: 42, name: 'Example', imageUrl: null }),
      description: '',
      publishers: [],
    };

    expect(toGameInput({ game, versions: [] })).toMatchObject({
      description: null,
      publisher: null,
      imageUrlRaw: null,
      thumbUrlRaw: null,
    });
  });
});
