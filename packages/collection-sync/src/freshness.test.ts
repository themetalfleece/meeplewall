import { describe, expect, it } from 'vitest';

import {
  SYNC_ABANDONED_AFTER_SECONDS,
  SYNC_THROTTLE_SECONDS,
  isOlderThan,
  isSyncAbandoned,
  secondsUntilNextSync,
} from './freshness.ts';

const NOW = new Date('2026-10-18T12:00:00.000Z');

function secondsBefore(seconds: number): Date {
  return new Date(NOW.getTime() - seconds * 1_000);
}

describe('isOlderThan', () => {
  it('is false at exactly the maximum age', () => {
    expect(isOlderThan({ timestamp: secondsBefore(60), now: NOW, maxAgeSeconds: 60 })).toBe(false);
  });

  it('is true one millisecond past the maximum age', () => {
    const timestamp = new Date(secondsBefore(60).getTime() - 1);

    expect(isOlderThan({ timestamp, now: NOW, maxAgeSeconds: 60 })).toBe(true);
  });

  it('is false for a timestamp in the future', () => {
    expect(isOlderThan({ timestamp: secondsBefore(-10), now: NOW, maxAgeSeconds: 0 })).toBe(false);
  });
});

describe('isSyncAbandoned', () => {
  const longAgo = secondsBefore(SYNC_ABANDONED_AFTER_SECONDS + 1);

  it('is true for a running sync that started too long ago', () => {
    expect(isSyncAbandoned({ sync: { status: 'running', startedAt: longAgo }, now: NOW })).toBe(
      true,
    );
  });

  it('is false for a running sync that started recently', () => {
    const startedAt = secondsBefore(SYNC_ABANDONED_AFTER_SECONDS - 1);

    expect(isSyncAbandoned({ sync: { status: 'running', startedAt }, now: NOW })).toBe(false);
  });

  it('is false for a finished sync however old', () => {
    expect(isSyncAbandoned({ sync: { status: 'succeeded', startedAt: longAgo }, now: NOW })).toBe(
      false,
    );
    expect(isSyncAbandoned({ sync: { status: 'failed', startedAt: longAgo }, now: NOW })).toBe(
      false,
    );
  });
});

describe('secondsUntilNextSync', () => {
  it('waits the whole window right after a sync started', () => {
    expect(secondsUntilNextSync({ startedAt: NOW, now: NOW })).toBe(SYNC_THROTTLE_SECONDS);
  });

  it('rounds a partial second up', () => {
    expect(secondsUntilNextSync({ startedAt: secondsBefore(10.5), now: NOW })).toBe(
      SYNC_THROTTLE_SECONDS - 10,
    );
  });

  it('is 0 once the window has passed', () => {
    expect(
      secondsUntilNextSync({ startedAt: secondsBefore(SYNC_THROTTLE_SECONDS), now: NOW }),
    ).toBe(0);
    expect(secondsUntilNextSync({ startedAt: secondsBefore(3_600), now: NOW })).toBe(0);
  });
});
