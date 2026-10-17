import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { RequestThrottle, retryDelayMs } from './http.ts';

describe('retryDelayMs', () => {
  it('doubles from one second', () => {
    expect([1, 2, 3, 4].map((attempt) => retryDelayMs({ attempt, retryAfter: null }))).toEqual([
      1000, 2000, 4000, 8000,
    ]);
  });

  it('caps the backoff at 30 seconds', () => {
    expect(retryDelayMs({ attempt: 10, retryAfter: null })).toBe(30_000);
  });

  it('honours Retry-After in seconds', () => {
    expect(retryDelayMs({ attempt: 1, retryAfter: '7' })).toBe(7000);
  });

  it('caps Retry-After at 30 seconds', () => {
    expect(retryDelayMs({ attempt: 1, retryAfter: '600' })).toBe(30_000);
  });

  it.each(['', 'Wed, 21 Oct 2026 07:28:00 GMT'])(
    'falls back to the backoff for a Retry-After of %j',
    (retryAfter) => {
      expect(retryDelayMs({ attempt: 2, retryAfter })).toBe(2000);
    },
  );
});

describe('RequestThrottle', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('spaces queued requests by the interval', async () => {
    const throttle = new RequestThrottle({ requestsPerSecond: 4 });
    const startedAt: number[] = [];
    const start = Date.now();
    const requests = [1, 2, 3].map(async () => {
      await throttle.waitForSlot();
      startedAt.push(Date.now() - start);
    });

    await vi.runAllTimersAsync();
    await Promise.all(requests);

    expect(startedAt).toEqual([0, 250, 500]);
  });

  it('lets a request through at once after an idle gap', async () => {
    const throttle = new RequestThrottle({ requestsPerSecond: 1 });

    await throttle.waitForSlot();
    vi.advanceTimersByTime(5000);

    const before = Date.now();
    await throttle.waitForSlot();

    expect(Date.now() - before).toBe(0);
  });
});
