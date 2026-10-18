// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';

import { getQueryClient } from './query-client';

describe('getQueryClient', () => {
  it('reuses one client in the browser', () => {
    expect(getQueryClient()).toBe(getQueryClient());
  });

  it('creates a new client for each server render', () => {
    vi.stubGlobal('window', undefined);
    try {
      expect(getQueryClient()).not.toBe(getQueryClient());
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
