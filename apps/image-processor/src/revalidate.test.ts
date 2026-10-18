import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { createRevalidate } from './revalidate.ts';
import { StubServer } from './testing/stub-server.ts';

const PATH = '/api/internal/revalidate';
const SECRET = 'a-revalidate-secret-of-at-least-32-chars';

// A local stub plays apps/web's revalidate route.
describe('createRevalidate', () => {
  let web: StubServer;

  beforeAll(async () => {
    web = await StubServer.start();
  });

  beforeEach(() => {
    web.reset();
  });

  afterAll(async () => {
    await web.close();
  });

  it('POSTs the game id as JSON with the secret as a bearer token', async () => {
    web.route({ path: PATH, response: { status: 204 } });
    const revalidate = createRevalidate({ webInternalUrl: web.baseUrl, secret: SECRET });

    await revalidate({ bggGameId: 362976 });

    expect(web.requests).toHaveLength(1);
    const [request] = web.requests;
    expect(request).toMatchObject({ method: 'POST', path: PATH });
    expect(request?.headers.authorization).toBe(`Bearer ${SECRET}`);
    expect(request?.headers['content-type']).toBe('application/json');
    expect(JSON.parse(request?.body ?? '')).toEqual({ bggGameId: 362976 });
  });

  it('resolves the route against a base URL that has a path', async () => {
    web.route({ path: PATH, response: { status: 200 } });
    const revalidate = createRevalidate({
      webInternalUrl: `${web.baseUrl}/ignored/`,
      secret: SECRET,
    });

    await revalidate({ bggGameId: 1 });

    expect(web.requestsTo(PATH)).toHaveLength(1);
  });

  it.each([401, 404, 500])('throws with the status when the web answers %i', async (status) => {
    web.route({ path: PATH, response: { status } });
    const revalidate = createRevalidate({ webInternalUrl: web.baseUrl, secret: SECRET });

    await expect(revalidate({ bggGameId: 1 })).rejects.toThrow(`Revalidate failed with ${status}`);
  });

  it('rejects when the web is unreachable', async () => {
    const unreachable = await StubServer.start();
    const baseUrl = unreachable.baseUrl;
    await unreachable.close();
    const revalidate = createRevalidate({ webInternalUrl: baseUrl, secret: SECRET });

    await expect(revalidate({ bggGameId: 1 })).rejects.toThrow();
  });
});
