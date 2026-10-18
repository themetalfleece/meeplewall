import { describe, expect, it } from 'vitest';

import { IDLE_SYNC_STATUS, syncStatusSchema } from './sync-status';

describe('syncStatusSchema', () => {
  it('accepts a finished sync', () => {
    expect(
      syncStatusSchema.parse({
        state: 'succeeded',
        startedAt: '2026-10-18T10:00:00.000Z',
        finishedAt: '2026-10-18T10:01:00.000Z',
      }),
    ).toMatchObject({ state: 'succeeded' });
  });

  it('rejects an unknown state', () => {
    expect(syncStatusSchema.safeParse({ ...IDLE_SYNC_STATUS, state: 'paused' }).success).toBe(
      false,
    );
  });
});
