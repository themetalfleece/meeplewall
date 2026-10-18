import { describe, expect, it } from 'vitest';

import { collectionOgText } from './OgImage.data';

describe('collectionOgText', () => {
  it('names the stored collection and counts its games', () => {
    expect(
      collectionOgText({
        summary: { displayName: 'Alice', itemCount: 12, coverUrls: [] },
        username: 'alice',
      }),
    ).toEqual({ title: "Alice's collection", subtitle: '12 board games' });
  });

  it('counts a single game in the singular', () => {
    expect(
      collectionOgText({
        summary: { displayName: 'Bo', itemCount: 1, coverUrls: [] },
        username: 'bo',
      }).subtitle,
    ).toBe('1 board game');
  });

  it('names a collection not stored yet by its URL username', () => {
    expect(collectionOgText({ summary: null, username: 'newcomer' })).toEqual({
      title: "newcomer's collection",
      subtitle: null,
    });
  });

  it('says so for an invalid username', () => {
    expect(collectionOgText({ summary: null, username: null }).title).toBe('Collection not found');
  });
});
