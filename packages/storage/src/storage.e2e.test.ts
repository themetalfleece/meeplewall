import { randomUUID } from 'node:crypto';

import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { createStorage, type Storage, type StorageOptions } from './storage.js';

// Round trip against the compose minio. Skips when the STORAGE_* variables are unset or minio
// is not answering, so a machine without the stack reports skipped rather than green.

const storageEnvironmentSchema = z.object({
  STORAGE_ENDPOINT: z.string(),
  STORAGE_ACCESS_KEY_ID: z.string(),
  STORAGE_SECRET_ACCESS_KEY: z.string(),
  STORAGE_BUCKET: z.string(),
  STORAGE_PUBLIC_BASE_URL: z.string(),
  STORAGE_FORCE_PATH_STYLE: z.stringbool(),
});

function readStorageOptions(): StorageOptions | null {
  const result = storageEnvironmentSchema.safeParse(process.env);

  if (!result.success) {
    return null;
  }

  return {
    endpoint: result.data.STORAGE_ENDPOINT,
    accessKeyId: result.data.STORAGE_ACCESS_KEY_ID,
    secretAccessKey: result.data.STORAGE_SECRET_ACCESS_KEY,
    bucket: result.data.STORAGE_BUCKET,
    publicBaseUrl: result.data.STORAGE_PUBLIC_BASE_URL,
    forcePathStyle: result.data.STORAGE_FORCE_PATH_STYLE,
  };
}

async function isMinioLive(endpoint: string): Promise<boolean> {
  try {
    const response = await fetch(new URL('/minio/health/live', endpoint), {
      signal: AbortSignal.timeout(2000),
    });

    return response.ok;
  } catch {
    return false;
  }
}

async function connectToMinio(): Promise<Storage | null> {
  const options = readStorageOptions();

  if (options === null || !(await isMinioLive(options.endpoint))) {
    return null;
  }

  return createStorage(options);
}

const minio = await connectToMinio();

function requireMinio(): Storage {
  if (minio === null) {
    throw new Error('minio is not reachable');
  }

  return minio;
}

describe.skipIf(minio === null)('storage round trip against minio', () => {
  it('puts, serves publicly, heads and deletes an object', async () => {
    const storage = requireMinio();
    const key = `e2e/${randomUUID()}/cover art.png`;
    const body = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);

    await storage.putObject({
      key,
      body,
      contentType: 'image/png',
      cacheControl: 'public, max-age=31536000, immutable',
    });

    try {
      const response = await fetch(storage.getPublicUrl({ key }));

      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toBe('image/png');
      expect(new Uint8Array(await response.arrayBuffer())).toEqual(body);

      expect(await storage.headObject({ key })).toMatchObject({
        contentType: 'image/png',
        contentLength: body.byteLength,
        cacheControl: 'public, max-age=31536000, immutable',
      });
    } finally {
      await storage.deleteObject({ key });
    }

    expect(await storage.headObject({ key })).toBeNull();
  });

  it('heads a missing key as null', async () => {
    const storage = requireMinio();

    expect(await storage.headObject({ key: `e2e/${randomUUID()}/missing.png` })).toBeNull();
  });

  it('deletes a missing key without throwing', async () => {
    const storage = requireMinio();

    await expect(
      storage.deleteObject({ key: `e2e/${randomUUID()}/missing.png` }),
    ).resolves.toBeUndefined();
  });
});
