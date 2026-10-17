import {
  DeleteObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
  S3ServiceException,
} from '@aws-sdk/client-s3';
import { z } from 'zod';

const httpUrlSchema = z.url({ protocol: /^https?$/ });

const storageOptionsSchema = z.object({
  endpoint: httpUrlSchema,
  accessKeyId: z.string().min(1),
  secretAccessKey: z.string().min(1),
  bucket: z.string().min(1),
  publicBaseUrl: httpUrlSchema.transform((url) => url.replace(/\/+$/, '')),
  forcePathStyle: z.boolean(),
});

/** Connection settings for an S3-compatible bucket: Cloudflare R2 in production, minio locally. */
export type StorageOptions = z.input<typeof storageOptionsSchema>;

/** The metadata `headObject` returns for an object that exists. */
export interface ObjectHead {
  contentType: string | undefined;
  contentLength: number | undefined;
  cacheControl: string | undefined;
  etag: string | undefined;
  lastModified: Date | undefined;
}

// R2 only accepts `auto` (or an alias of it); minio ignores the region unless one is configured.
const region = 'auto';

class Storage {
  readonly #client: S3Client;
  readonly #bucket: string;
  readonly #publicBaseUrl: string;

  constructor(options: z.output<typeof storageOptionsSchema>) {
    this.#client = new S3Client({
      endpoint: options.endpoint,
      region,
      forcePathStyle: options.forcePathStyle,
      credentials: {
        accessKeyId: options.accessKeyId,
        secretAccessKey: options.secretAccessKey,
      },
    });
    this.#bucket = options.bucket;
    this.#publicBaseUrl = options.publicBaseUrl;
  }

  /** Uploads `body` under `key`, replacing any existing object. */
  async putObject({
    key,
    body,
    contentType,
    cacheControl,
  }: {
    key: string;
    body: Uint8Array | string;
    contentType: string;
    cacheControl: string;
  }): Promise<void> {
    await this.#client.send(
      new PutObjectCommand({
        Bucket: this.#bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
        CacheControl: cacheControl,
      }),
    );
  }

  /** The URL the object is served from publicly. Makes no request, so it does not check that the object exists. */
  getPublicUrl({ key }: { key: string }): string {
    const encodedKey = key.split('/').map(encodeURIComponent).join('/');

    return `${this.#publicBaseUrl}/${encodedKey}`;
  }

  /** The object's metadata, or `null` when no object exists under `key`. */
  async headObject({ key }: { key: string }): Promise<ObjectHead | null> {
    try {
      const response = await this.#client.send(
        new HeadObjectCommand({ Bucket: this.#bucket, Key: key }),
      );

      return {
        contentType: response.ContentType,
        contentLength: response.ContentLength,
        cacheControl: response.CacheControl,
        etag: response.ETag,
        lastModified: response.LastModified,
      };
    } catch (error) {
      if (error instanceof S3ServiceException && error.$metadata.httpStatusCode === 404) {
        return null;
      }

      throw error;
    }
  }

  /** Deletes the object under `key`. Succeeds when there is nothing to delete. */
  async deleteObject({ key }: { key: string }): Promise<void> {
    await this.#client.send(new DeleteObjectCommand({ Bucket: this.#bucket, Key: key }));
  }
}

export type { Storage };

/**
 * Validates `options` and returns a client for one bucket.
 *
 * @throws Error naming every missing or malformed option.
 */
export function createStorage(options: StorageOptions): Storage {
  const result = storageOptionsSchema.safeParse(options);

  if (!result.success) {
    const problems = result.error.issues.map(
      (issue) => `${issue.path.join('.')}: ${issue.message}`,
    );

    throw new Error(`Invalid storage options. ${problems.join('; ')}`);
  }

  return new Storage(result.data);
}
