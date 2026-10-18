import { describe, expect, it } from 'vitest';
import { createStorage } from './storage.js';
import type { StorageOptions } from './storage.js';

const validOptions: StorageOptions = {
  endpoint: 'http://localhost:9000',
  accessKeyId: 'access-key',
  secretAccessKey: 'secret-key',
  bucket: 'meeplewall',
  publicBaseUrl: 'http://localhost:9000/meeplewall',
  forcePathStyle: true,
};

function optionsWithout(field: keyof StorageOptions): StorageOptions {
  const options = { ...validOptions };
  Reflect.deleteProperty(options, field);

  return options;
}

describe('createStorage', () => {
  it('accepts a complete set of options', () => {
    expect(() => createStorage(validOptions)).not.toThrow();
  });

  it.each([
    'endpoint',
    'accessKeyId',
    'secretAccessKey',
    'bucket',
    'publicBaseUrl',
    'forcePathStyle',
  ] satisfies (keyof StorageOptions)[])('throws naming %s when it is missing', (field) => {
    expect(() => createStorage(optionsWithout(field))).toThrow(new RegExp(`\\b${field}:`));
  });

  it.each([
    ['endpoint', { endpoint: 'localhost:9000' }],
    ['endpoint', { endpoint: '' }],
    ['accessKeyId', { accessKeyId: '' }],
    ['secretAccessKey', { secretAccessKey: '' }],
    ['bucket', { bucket: '' }],
    ['publicBaseUrl', { publicBaseUrl: 'not a url' }],
  ] satisfies [keyof StorageOptions, Partial<StorageOptions>][])(
    'throws naming %s when it is malformed',
    (field, override) => {
      expect(() => createStorage({ ...validOptions, ...override })).toThrow(
        new RegExp(`\\b${field}:`),
      );
    },
  );

  it('names every invalid field at once', () => {
    expect(() => createStorage({ ...validOptions, bucket: '', endpoint: 'nope' })).toThrow(
      /endpoint:.*bucket:/,
    );
  });
});

describe('getPublicUrl', () => {
  it('joins the public base URL and the key', () => {
    const storage = createStorage(validOptions);

    expect(storage.getPublicUrl({ key: 'covers/123.webp' })).toBe(
      'http://localhost:9000/meeplewall/covers/123.webp',
    );
  });

  it('does not double the slash when the base URL ends in one', () => {
    const storage = createStorage({ ...validOptions, publicBaseUrl: 'https://cdn.example.com/' });

    expect(storage.getPublicUrl({ key: 'covers/123.webp' })).toBe(
      'https://cdn.example.com/covers/123.webp',
    );
  });

  it('percent-encodes each path segment but keeps the slashes', () => {
    const storage = createStorage(validOptions);

    expect(storage.getPublicUrl({ key: 'covers/Ark Nova #1?.webp' })).toBe(
      'http://localhost:9000/meeplewall/covers/Ark%20Nova%20%231%3F.webp',
    );
  });
});
