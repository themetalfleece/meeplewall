import { inArray } from 'drizzle-orm';

import type { DatabaseExecutor } from '../database.ts';
import { imageAssets, type ImageAsset } from '../schema/index.ts';

/** Reads every processed image of the given games, in no particular order. */
export async function listImageAssets(
  database: DatabaseExecutor,
  { bggGameIds }: { bggGameIds: number[] },
): Promise<ImageAsset[]> {
  if (bggGameIds.length === 0) {
    return [];
  }

  return database.select().from(imageAssets).where(inArray(imageAssets.bggGameId, bggGameIds));
}
