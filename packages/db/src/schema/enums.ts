import { pgEnum } from 'drizzle-orm/pg-core';

export const imageKind = pgEnum('image_kind', ['cover', 'thumb']);

export const imageJobStatus = pgEnum('image_job_status', [
  'pending',
  'processing',
  'ready',
  'failed',
]);

/** Which BGG transport a collection was fetched through. */
export const collectionSource = pgEnum('collection_source', ['geekdo', 'xmlapi2']);

export const refreshSource = pgEnum('refresh_source', ['cron', 'user', 'api']);

export const refreshStatus = pgEnum('refresh_status', ['succeeded', 'failed']);

export const collectionSyncStatus = pgEnum('collection_sync_status', [
  'running',
  'succeeded',
  'failed',
]);

export type ImageKind = (typeof imageKind.enumValues)[number];
export type ImageJobStatus = (typeof imageJobStatus.enumValues)[number];
export type CollectionSource = (typeof collectionSource.enumValues)[number];
export type RefreshSource = (typeof refreshSource.enumValues)[number];
export type RefreshStatus = (typeof refreshStatus.enumValues)[number];
export type CollectionSyncStatus = (typeof collectionSyncStatus.enumValues)[number];
