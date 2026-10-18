import { describe, expect, it } from 'vitest';

import { formatCount, formatRange, formatRating, formatWeight } from './format';

describe('formatRating', () => {
  it('shows a whole rating without decimals', () => {
    expect(formatRating(8)).toBe('8');
  });

  it('shows one decimal otherwise', () => {
    expect(formatRating(7.5)).toBe('7.5');
    expect(formatRating(7.04)).toBe('7.0');
  });
});

describe('formatRange', () => {
  it('shows both ends', () => {
    expect(formatRange({ min: 2, max: 4, unit: 'players' })).toBe('2 to 4 players');
  });

  it('collapses equal ends', () => {
    expect(formatRange({ min: 45, max: 45, unit: 'min' })).toBe('45 min');
  });

  it('shows the one known end', () => {
    expect(formatRange({ min: null, max: 5, unit: 'players' })).toBe('5 players');
  });

  it('orders reversed ends', () => {
    expect(formatRange({ min: 90, max: 30, unit: 'min' })).toBe('30 to 90 min');
  });

  it('is null when neither end is known', () => {
    expect(formatRange({ min: null, max: null, unit: 'players' })).toBeNull();
  });
});

describe('formatWeight', () => {
  it('shows two decimals out of five', () => {
    expect(formatWeight(2.3456)).toBe('2.35 / 5');
  });
});

describe('formatCount', () => {
  it('groups thousands', () => {
    expect(formatCount(12345)).toBe('12,345');
    expect(formatCount(0)).toBe('0');
  });
});
