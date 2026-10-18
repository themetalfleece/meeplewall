import { describe, expect, it } from 'vitest';

import { jsonError, NO_STORE_HEADERS } from './responses';

describe('jsonError', () => {
  it('answers JSON with the status and no caching', async () => {
    const response = jsonError({ message: 'Invalid username', status: 400 });

    expect(response.status).toBe(400);
    expect(response.headers.get('cache-control')).toBe(NO_STORE_HEADERS['Cache-Control']);
    expect(await response.json()).toEqual({ error: 'Invalid username' });
  });
});
