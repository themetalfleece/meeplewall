import { describe, expect, it } from 'vitest';

import { GET } from './route';

async function redirectFor({ path, uId }: { path: string; uId: string }): Promise<Response> {
  return GET(new Request(`https://meeplewall.com${path}`), { params: Promise.resolve({ uId }) });
}

describe('GET /collection/user/[uId]', () => {
  it('permanently redirects a plain name to its shelf', async () => {
    const response = await redirectFor({ path: '/collection/user/alice', uId: 'alice' });

    expect(response.status).toBe(308);
    expect(response.headers.get('Location')).toBe('/u/alice');
  });

  it('keeps a name that needs encoding encoded', async () => {
    const response = await redirectFor({
      path: '/collection/user/first%20last',
      uId: 'first%20last',
    });

    expect(response.status).toBe(308);
    expect(response.headers.get('Location')).toBe('/u/first%20last');
  });

  it('redirects a trailing-slash path once Next has dropped the slash', async () => {
    const response = await redirectFor({ path: '/collection/user/alice/', uId: 'alice' });

    expect(response.status).toBe(308);
    expect(response.headers.get('Location')).toBe('/u/alice');
  });

  it("drops BGG's query string", async () => {
    const response = await redirectFor({
      path: '/collection/user/alice?own=1&subtype=boardgame',
      uId: 'alice',
    });

    expect(response.status).toBe(308);
    expect(response.headers.get('Location')).toBe('/u/alice');
  });

  it('passes an invalid name through for the shelf to reject', async () => {
    const response = await redirectFor({
      path: '/collection/user/%3Cscript%3E',
      uId: '%3Cscript%3E',
    });

    expect(response.status).toBe(308);
    expect(response.headers.get('Location')).toBe('/u/%3Cscript%3E');
  });

  it('re-encodes a malformed escape rather than throwing', async () => {
    const response = await redirectFor({ path: '/collection/user/%E0%A4%A', uId: '%E0%A4%A' });

    expect(response.status).toBe(308);
    expect(response.headers.get('Location')).toBe('/u/%25E0%25A4%25A');
  });
});
