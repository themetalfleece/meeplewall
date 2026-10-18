import { describe, expect, it } from 'vitest';

import {
  decodeSegment,
  gameSegment,
  gameSlug,
  parseGameId,
  parseUsername,
  routes,
  validateUsername,
} from './route-params';

describe('parseUsername', () => {
  it.each(['themetalfleece', 'Some_User', 'a', 'first last', 'dotted.name-2'])(
    'accepts %s',
    (username) => {
      expect(parseUsername(username)).toBe(username);
    },
  );

  it('decodes a percent-encoded segment', () => {
    expect(parseUsername('first%20last')).toBe('first last');
  });

  it.each(['', ' ', '-leading-dash', 'a/b', '<script>', 'x'.repeat(51), '%E0%A4%A'])(
    'rejects %j',
    (segment) => {
      expect(parseUsername(segment)).toBeNull();
    },
  );
});

describe('decodeSegment', () => {
  it('decodes percent escapes', () => {
    expect(decodeSegment('first%20last')).toBe('first last');
  });

  it('returns an unescaped segment unchanged', () => {
    expect(decodeSegment('alice')).toBe('alice');
  });

  it('returns null for a malformed escape', () => {
    expect(decodeSegment('%E0%A4%A')).toBeNull();
  });
});

describe('validateUsername', () => {
  it('trims surrounding spaces', () => {
    expect(validateUsername('  alice ')).toBe('alice');
  });

  it('does not decode, so a literal percent sign is rejected', () => {
    expect(validateUsername('first%20last')).toBeNull();
  });
});

describe('parseGameId', () => {
  it('parses a positive integer', () => {
    expect(parseGameId('363289')).toBe(363289);
  });

  it.each(['13-catan', '13-the-settlers-of-catan', '13-Stale%20Name', '13-'])(
    'ignores the slug in %j',
    (segment) => {
      expect(parseGameId(segment)).toBe(13);
    },
  );

  it.each(['0', '-1', '1.5', '012', 'abc', '', '1234567890', '0-catan', '012-catan', 'catan-13'])(
    'rejects %j',
    (segment) => {
      expect(parseGameId(segment)).toBeNull();
    },
  );
});

describe('gameSlug', () => {
  it('lowercases and joins words with dashes', () => {
    expect(gameSlug('Ticket to Ride: Europe')).toBe('ticket-to-ride-europe');
  });

  it('removes accents', () => {
    expect(gameSlug('Café Crème Brûlée')).toBe('cafe-creme-brulee');
  });

  it('collapses punctuation runs and trims dashes at both ends', () => {
    expect(gameSlug('  "7 Wonders" -- Duel!! ')).toBe('7-wonders-duel');
  });

  it.each(['カタン', '!!!', ''])('is empty when nothing survives in %j', (name) => {
    expect(gameSlug(name)).toBe('');
  });

  it('cuts a long name without leaving a trailing dash', () => {
    const slug = gameSlug(`${'a'.repeat(59)} and more words after it`);

    expect(slug).toBe('a'.repeat(59));
  });

  it('keeps a long slug within 60 characters', () => {
    expect(gameSlug('word '.repeat(40)).length).toBeLessThanOrEqual(60);
  });
});

describe('gameSegment', () => {
  it('appends the slug to the id', () => {
    expect(gameSegment({ bggId: 13, name: 'CATAN' })).toBe('13-catan');
  });

  it('is just the id when the slug is empty', () => {
    expect(gameSegment({ bggId: 13, name: 'カタン' })).toBe('13');
  });
});

describe('routes', () => {
  it('encodes the username in every user route', () => {
    expect(routes.collection('first last')).toBe('/u/first%20last');
    expect(routes.collectionGame({ username: 'first last', bggId: 13, name: 'CATAN' })).toBe(
      '/u/first%20last/g/13-catan',
    );
    expect(routes.syncStatus('a b')).toBe('/api/sync/a%20b');
    expect(routes.refresh('a b')).toBe('/api/refresh/a%20b');
  });

  it('builds the game route with its slug', () => {
    expect(routes.game({ bggId: 13, name: 'CATAN' })).toBe('/g/13-catan');
  });

  it('leaves the main wall without a shelf query', () => {
    expect(routes.collectionShelf({ username: 'alice', shelf: 'owned' })).toBe('/u/alice');
    expect(
      routes.collectionGame({ username: 'alice', shelf: 'owned', bggId: 13, name: 'CATAN' }),
    ).toBe('/u/alice/g/13-catan');
  });

  it('names any other shelf in the query', () => {
    expect(routes.collectionShelf({ username: 'alice', shelf: 'wantToPlay' })).toBe(
      '/u/alice?shelf=want-to-play',
    );
    expect(
      routes.collectionGame({ username: 'alice', shelf: 'wishlist', bggId: 13, name: 'CATAN' }),
    ).toBe('/u/alice/g/13-catan?shelf=wishlist');
  });
});
