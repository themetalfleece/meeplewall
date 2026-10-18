import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  bggApiToken,
  bggUserAgent,
  databaseUrl,
  internalRevalidateSecret,
  readVariable,
  siteUrl,
  storagePublicBaseUrl,
} from './env';

const SECRET = 'a'.repeat(32);

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('readVariable', () => {
  it('returns a valid value', () => {
    expect(
      readVariable({ name: 'SITE_URL', environment: { SITE_URL: 'https://example.com' } }),
    ).toBe('https://example.com');
  });

  it('throws naming a missing variable', () => {
    expect(() => readVariable({ name: 'DATABASE_URL', environment: {} })).toThrow(
      'DATABASE_URL is not set',
    );
  });

  it('treats an empty value as missing', () => {
    expect(() =>
      readVariable({ name: 'BGG_API_TOKEN', environment: { BGG_API_TOKEN: '' } }),
    ).toThrow('BGG_API_TOKEN is not set');
  });

  it('throws naming an invalid variable without echoing its value', () => {
    const read = () =>
      readVariable({
        name: 'INTERNAL_REVALIDATE_SECRET',
        environment: { INTERNAL_REVALIDATE_SECRET: 'short-secret' },
      });

    expect(read).toThrow('INTERNAL_REVALIDATE_SECRET is invalid: must be at least 32 characters');
    expect(read).not.toThrow(/short-secret/);
  });

  it('rejects a URL without an http scheme', () => {
    expect(() =>
      readVariable({
        name: 'STORAGE_PUBLIC_BASE_URL',
        environment: { STORAGE_PUBLIC_BASE_URL: 'localhost:9000/bucket' },
      }),
    ).toThrow('STORAGE_PUBLIC_BASE_URL is invalid');
  });
});

describe('accessors', () => {
  it('read each variable from process.env', () => {
    vi.stubEnv('SITE_URL', 'https://boards.example.com');
    vi.stubEnv('DATABASE_URL', 'postgres://localhost/test');
    vi.stubEnv('STORAGE_PUBLIC_BASE_URL', 'https://cdn.example.com');
    vi.stubEnv('BGG_USER_AGENT', 'tests');
    vi.stubEnv('BGG_API_TOKEN', 'token');
    vi.stubEnv('INTERNAL_REVALIDATE_SECRET', SECRET);

    expect(siteUrl().origin).toBe('https://boards.example.com');
    expect(databaseUrl()).toBe('postgres://localhost/test');
    expect(storagePublicBaseUrl()).toBe('https://cdn.example.com');
    expect(bggUserAgent()).toBe('tests');
    expect(bggApiToken()).toBe('token');
    expect(internalRevalidateSecret()).toBe(SECRET);
  });

  it('throw when their variable is unset', () => {
    vi.stubEnv('SITE_URL', undefined);

    expect(() => siteUrl()).toThrow('SITE_URL is not set');
  });
});
