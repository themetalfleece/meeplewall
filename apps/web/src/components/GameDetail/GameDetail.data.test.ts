import { describe, expect, it } from 'vitest';

import type { GameView } from '@/lib/games';

import { bggGameUrl, gameFacts, gameTags } from './GameDetail.data';

const GAME: GameView = {
  bggId: 13,
  name: 'CATAN',
  year: 1995,
  description: null,
  players: { min: 3, max: 4 },
  playTime: { min: 60, max: 120 },
  weight: 2.3,
  averageRating: 7.1,
  ratingCount: 120_000,
  categories: [],
  mechanics: [],
  publisher: 'KOSMOS',
  images: {
    coverUrl: null,
    thumbUrl: null,
    processedCoverUrl: null,
    originalUrl: null,
    sideColor: null,
    edgeColor: null,
  },
  box: {
    size: { width: 296, height: 296, depth: 72 },
    covers: { front: '/placeholder-cover.png' },
    sideColor: '#2a2a2e',
    edgeColor: '#1a1a1d',
  },
};

describe('gameFacts', () => {
  it('lists every known fact in order', () => {
    expect(gameFacts(GAME)).toEqual([
      { label: 'Players', value: '3 to 4 players' },
      { label: 'Playing time', value: '60 to 120 min' },
      { label: 'Weight', value: '2.30 / 5' },
      { label: 'BGG rating', value: '7.1 from 120,000 ratings' },
      { label: 'Publisher', value: 'KOSMOS' },
    ]);
  });

  it('skips facts BGG does not know', () => {
    const facts = gameFacts({
      ...GAME,
      players: { min: null, max: null },
      weight: null,
      averageRating: null,
      publisher: null,
    });

    expect(facts.map((fact) => fact.label)).toEqual(['Playing time']);
  });

  it('shows a rating without its count when the count is unknown', () => {
    expect(gameFacts({ ...GAME, ratingCount: null })).toContainEqual({
      label: 'BGG rating',
      value: '7.1',
    });
  });
});

describe('gameTags', () => {
  it('lists categories then mechanics, each term once', () => {
    expect(
      gameTags({ categories: ['Economic', 'Negotiation'], mechanics: ['Negotiation', 'Trading'] }),
    ).toEqual(['Economic', 'Negotiation', 'Trading']);
  });

  it('is empty for a game with neither', () => {
    expect(gameTags({ categories: [], mechanics: [] })).toEqual([]);
  });
});

describe('bggGameUrl', () => {
  it('links to the game on BGG', () => {
    expect(bggGameUrl(13)).toBe('https://boardgamegeek.com/boardgame/13');
  });
});
