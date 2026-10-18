import { z } from 'zod';

import { htmlToPlainText } from './html.ts';

// Response shapes of api.geekdo.com, transformed into the public camelCase types. Only the fields
// we use are listed.

/** BGG sends numbers as strings, and `0` or `""` where a value is unknown. Those become null. */
const optionalPositiveNumberSchema = z
  .union([z.number(), z.string()])
  .nullish()
  .transform((value) => {
    const parsed = Number(value ?? 0);

    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  });

const countSchema = z
  .union([z.number(), z.string()])
  .transform(Number)
  .pipe(z.number().int().nonnegative());

/** A BGG object id, sent as a number or a numeric string. */
export const bggIdSchema = z
  .union([z.number(), z.string()])
  .transform(Number)
  .pipe(z.number().int().positive());

const linkSchema = z
  .object({ objectid: bggIdSchema, name: z.string() })
  .transform(({ objectid, name }) => ({ id: objectid, name }));

const linksSchema = z.array(linkSchema).default([]);

const plainTextSchema = z
  .string()
  .nullish()
  .transform((html) => htmlToPlainText(html ?? ''));

export const gameItemResponseSchema = z
  .object({
    item: z.object({
      objectid: bggIdSchema,
      name: z.string(),
      yearpublished: optionalPositiveNumberSchema,
      minplayers: optionalPositiveNumberSchema,
      maxplayers: optionalPositiveNumberSchema,
      minplaytime: optionalPositiveNumberSchema,
      maxplaytime: optionalPositiveNumberSchema,
      minage: optionalPositiveNumberSchema,
      short_description: plainTextSchema,
      description: plainTextSchema,
      images: z.object({ original: z.url(), thumb: z.url() }).nullish(),
      links: z.object({
        boardgamedesigner: linksSchema,
        boardgameartist: linksSchema,
        boardgamepublisher: linksSchema,
        boardgamecategory: linksSchema,
        boardgamemechanic: linksSchema,
        boardgamefamily: linksSchema,
      }),
    }),
  })
  .transform(({ item }) => ({
    bggId: item.objectid,
    name: item.name,
    yearPublished: item.yearpublished,
    players: { min: item.minplayers, max: item.maxplayers },
    playTime: { min: item.minplaytime, max: item.maxplaytime },
    minAge: item.minage,
    shortDescription: item.short_description,
    description: item.description,
    imageUrl: item.images?.original ?? null,
    thumbnailUrl: item.images?.thumb ?? null,
    designers: item.links.boardgamedesigner,
    artists: item.links.boardgameartist,
    publishers: item.links.boardgamepublisher,
    categories: item.links.boardgamecategory,
    mechanics: item.links.boardgamemechanic,
    families: item.links.boardgamefamily,
  }));

export type BggGameItem = z.output<typeof gameItemResponseSchema>;
export type BggLink = BggGameItem['designers'][number];

export const gameStatsResponseSchema = z
  .object({
    item: z.object({
      stats: z.object({
        average: optionalPositiveNumberSchema,
        usersrated: countSchema,
        avgweight: optionalPositiveNumberSchema,
        numweights: countSchema,
      }),
      // The first entry is the overall board game rank; the rest are per-genre ranks.
      rankinfo: z.array(z.object({ rank: optionalPositiveNumberSchema })),
    }),
  })
  .transform(({ item }) => ({
    averageRating: item.stats.average,
    ratingCount: item.stats.usersrated,
    weight: item.stats.avgweight,
    weightCount: item.stats.numweights,
    rank: item.rankinfo[0]?.rank ?? null,
  }));

export type BggGameStats = z.output<typeof gameStatsResponseSchema>;

const gameVersionSchema = z
  .object({
    objectid: bggIdSchema,
    name: z.string(),
    yearpublished: optionalPositiveNumberSchema,
    length: optionalPositiveNumberSchema,
    width: optionalPositiveNumberSchema,
    depth: optionalPositiveNumberSchema,
    links: z
      .object({ boardgamepublisher: linksSchema, languages: linksSchema })
      .default({ boardgamepublisher: [], languages: [] }),
  })
  .transform((version) => ({
    versionId: version.objectid,
    name: version.name,
    yearPublished: version.yearpublished,
    dimensions: toDimensions(version),
    publishers: version.links.boardgamepublisher,
    languages: version.links.languages,
  }));

/** Contributor-entered and unit-less: some editions are in inches, some in centimetres. */
export type VersionDimensions = { length: number; width: number; depth: number };

function toDimensions(version: {
  length: number | null;
  width: number | null;
  depth: number | null;
}): VersionDimensions | null {
  if (version.length === null || version.width === null || version.depth === null) {
    return null;
  }

  return { length: version.length, width: version.width, depth: version.depth };
}

export type BggGameVersion = z.output<typeof gameVersionSchema>;

export const gameVersionsPageResponseSchema = z
  .object({
    items: z.array(gameVersionSchema),
    config: z.object({ numitems: countSchema }).optional(),
  })
  .transform(({ items, config }) => ({
    versions: items,
    totalCount: config === undefined ? null : config.numitems,
  }));
