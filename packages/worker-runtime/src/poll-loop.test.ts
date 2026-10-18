import { describe, expect, it } from 'vitest';

import { PollLoop } from './poll-loop.ts';

const NEVER_IDLE_LONG = 10_000;

describe('PollLoop', () => {
  it('polls again at once after a round that found work', async () => {
    const loop = new PollLoop({ idleMilliseconds: NEVER_IDLE_LONG });
    let rounds = 0;

    await loop.run({
      poll: () => {
        rounds += 1;
        if (rounds === 3) {
          loop.stop();
        }
        return Promise.resolve(true);
      },
      onError: () => {},
    });

    expect(rounds).toBe(3);
  });

  it('waits after a round that found nothing, and stop cuts the wait short', async () => {
    const loop = new PollLoop({ idleMilliseconds: NEVER_IDLE_LONG });
    let rounds = 0;
    const startedAt = performance.now();

    const running = loop.run({
      poll: () => {
        rounds += 1;
        return Promise.resolve(false);
      },
      onError: () => {},
    });
    setTimeout(() => {
      loop.stop();
    }, 50);
    await running;

    expect(rounds).toBe(1);
    expect(performance.now() - startedAt).toBeLessThan(NEVER_IDLE_LONG);
  });

  it('reports a round that throws and keeps polling', async () => {
    const loop = new PollLoop({ idleMilliseconds: 1 });
    const errors: unknown[] = [];
    let rounds = 0;

    await loop.run({
      poll: () => {
        rounds += 1;
        if (rounds === 2) {
          loop.stop();
          return Promise.resolve(true);
        }
        return Promise.reject(new Error('database is down'));
      },
      onError: (error) => errors.push(error),
    });

    expect(rounds).toBe(2);
    expect(errors).toEqual([new Error('database is down')]);
  });

  it('never polls once stopped', async () => {
    const loop = new PollLoop({ idleMilliseconds: 1 });
    loop.stop();
    let rounds = 0;

    await loop.run({
      poll: () => {
        rounds += 1;
        return Promise.resolve(true);
      },
      onError: () => {},
    });

    expect(loop.isStopping).toBe(true);
    expect(rounds).toBe(0);
  });
});
