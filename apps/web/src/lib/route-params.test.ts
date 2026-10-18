import { describe, expect, it } from 'vitest';

import { parseGameId, parseUsername, routes, validateUsername } from './route-params';

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

  it.each(['0', '-1', '1.5', '012', 'abc', '', '1234567890'])('rejects %j', (segment) => {
    expect(parseGameId(segment)).toBeNull();
  });
});

describe('routes', () => {
  it('encodes the username in every user route', () => {
    expect(routes.collection('first last')).toBe('/u/first%20last');
    expect(routes.collectionGame({ username: 'first last', bggId: 13 })).toBe(
      '/u/first%20last/g/13',
    );
    expect(routes.syncStatus('a b')).toBe('/api/sync/a%20b');
    expect(routes.refresh('a b')).toBe('/api/refresh/a%20b');
  });

  it('builds the game route', () => {
    expect(routes.game(13)).toBe('/g/13');
  });
});
