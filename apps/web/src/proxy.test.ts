import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

const { getGameName } = vi.hoisted(() => ({ getGameName: vi.fn() }));

vi.mock('@meeplewall/db', () => ({ getGameName }));
vi.mock('@/lib/services', () => ({ getDatabase: () => 'database' }));

const { proxy } = await import('./proxy');

async function respond(path: string): Promise<Response> {
  return proxy(new NextRequest(`https://meeplewall.com${path}`));
}

afterEach(() => {
  vi.resetAllMocks();
});

describe('proxy', () => {
  it('permanently redirects a missing slug to the canonical URL', async () => {
    getGameName.mockResolvedValue('CATAN');

    const response = await respond('/g/13');

    expect(response.status).toBe(308);
    expect(response.headers.get('Location')).toBe('https://meeplewall.com/g/13-catan');
  });

  it('permanently redirects a wrong slug and keeps the query', async () => {
    getGameName.mockResolvedValue('CATAN');

    const response = await respond('/u/alice/g/13-settlers?ref=share');

    expect(response.status).toBe(308);
    expect(response.headers.get('Location')).toBe(
      'https://meeplewall.com/u/alice/g/13-catan?ref=share',
    );
  });

  it('lets a correct slug through to the page', async () => {
    getGameName.mockResolvedValue('CATAN');

    const response = await respond('/g/13-catan');

    expect(response.headers.get('Location')).toBeNull();
    expect(response.headers.get('x-middleware-next')).toBe('1');
  });

  it('lets an unknown game through to its not-found page', async () => {
    getGameName.mockResolvedValue(undefined);

    const response = await respond('/g/404');

    expect(response.headers.get('Location')).toBeNull();
    expect(response.headers.get('x-middleware-next')).toBe('1');
  });
});
