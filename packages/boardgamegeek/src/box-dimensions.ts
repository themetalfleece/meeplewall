import type { BggGameVersion, VersionDimensions } from './schemas.ts';

const CENTIMETRES_PER_INCH = 2.54;

/** No boxed game has a side over about 15in (38cm), so a larger number must already be cm. */
const LARGEST_SIDE_IN_INCHES = 15;

/** Versions whose longest side is within this fraction of the median agree with each other. */
const CLUSTER_TOLERANCE = 0.2;

const SIZE_VARIANT_WORDS = [
  'xxl',
  'big box',
  'giant',
  'jumbo',
  'travel',
  'pocket',
  'mini',
  'deluxe',
  'anniversary',
  'collector',
] as const;

type SizeVariantWord = (typeof SIZE_VARIANT_WORDS)[number];

const SIZE_VARIANT_EDITION =
  /XXL|big box|bigbox|giant|jumbo|travel|pocket|mini\b|deluxe|anniversary|collector|kickstarter|legacy tin|tin\b|metal|20th|25th/i;
const GREEK_TEXT = /[Ͱ-Ͽἀ-῿]/;
const GREEK_PUBLISHER = /kaissa|desyllas|greek/i;

/** A box in centimetres, with the front face upright: `height` is its longer side. */
export type BoxSize = { width: number; height: number; depth: number };

export type BoxSizeSource = 'bgg-median' | 'bgg-greek-edition' | `bgg-variant:${SizeVariantWord}`;

export type BoxSizeEstimate = {
  size: BoxSize;
  source: BoxSizeSource;
  /** How many versions fed the median. */
  versionsUsed: number;
  versionsWithDimensions: number;
  /** 1 when every version used has the same longest side, falling to 0 as they spread. */
  agreement: number;
};

type MeasuredVersion = { name: string; size: BoxSize };

/**
 * Converts one version's contributor-entered dimensions to centimetres. A version whose largest
 * side is 15 or less is read as inches.
 */
export function normaliseToCentimetres(dimensions: VersionDimensions): BoxSize {
  const { length, width, depth } = dimensions;
  const largestSide = Math.max(length, width, depth);
  const scale = largestSide > LARGEST_SIDE_IN_INCHES ? 1 : CENTIMETRES_PER_INCH;

  return {
    width: Math.min(length, width) * scale,
    height: Math.max(length, width) * scale,
    depth: depth * scale,
  };
}

function median(values: number[]): number {
  const sorted = values.toSorted((first, second) => first - second);
  const middle = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 1) {
    return sorted[middle] ?? 0;
  }

  return ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2;
}

function roundTo({ value, decimals }: { value: number; decimals: number }): number {
  return Number(value.toFixed(decimals));
}

function findSizeVariantWord(title: string): SizeVariantWord | undefined {
  const lowerCaseTitle = title.toLowerCase();

  return SIZE_VARIANT_WORDS.find((word) => lowerCaseTitle.includes(word));
}

/**
 * Picks the versions that best represent the owned copy: the named size variant if the title has
 * one, else the Greek editions for a Greek title, else every standard-size edition.
 */
function selectVersions({ measured, title }: { measured: MeasuredVersion[]; title: string }): {
  pool: MeasuredVersion[];
  source: BoxSizeSource;
} {
  const variantWord = findSizeVariantWord(title);

  if (variantWord !== undefined) {
    const variantName = new RegExp(variantWord.replace(' ', '\\s*'), 'i');
    const variants = measured.filter((version) => variantName.test(version.name));

    if (variants.length > 0) {
      return { pool: variants, source: `bgg-variant:${variantWord}` };
    }
  }

  if (GREEK_TEXT.test(title)) {
    const greekEditions = measured.filter(
      (version) => GREEK_TEXT.test(version.name) || GREEK_PUBLISHER.test(version.name),
    );

    if (greekEditions.length > 0) {
      return { pool: greekEditions, source: 'bgg-greek-edition' };
    }
  }

  const standardEditions = measured.filter((version) => !SIZE_VARIANT_EDITION.test(version.name));

  if (standardEditions.length > 0) {
    return { pool: standardEditions, source: 'bgg-median' };
  }

  return { pool: measured, source: 'bgg-median' };
}

/**
 * Cross-checks a game's editions to estimate the owned copy's box size in centimetres.
 *
 * Normalises every version with dimensions, narrows them to the editions that match the owned
 * copy (see `selectVersions`), drops unit-misentered outliers by keeping the versions whose
 * longest side is within 20% of the median, and takes the median of each side. Returns null when
 * no version has dimensions.
 */
export function crossCheckBoxSize({
  versions,
  title,
}: {
  versions: BggGameVersion[];
  title: string;
}): BoxSizeEstimate | null {
  const measured = versions.flatMap((version) =>
    version.dimensions === null
      ? []
      : [{ name: version.name, size: normaliseToCentimetres(version.dimensions) }],
  );

  if (measured.length === 0) {
    return null;
  }

  const { pool, source } = selectVersions({ measured, title });
  const medianHeight = median(pool.map((version) => version.size.height));
  const dominant = pool.filter(
    (version) => Math.abs(version.size.height - medianHeight) <= CLUSTER_TOLERANCE * medianHeight,
  );
  const used = dominant.length > 0 ? dominant : pool;
  const heights = used.map((version) => version.size.height);
  const spread = used.length > 1 ? (Math.max(...heights) - Math.min(...heights)) / medianHeight : 0;

  return {
    size: {
      width: roundTo({ value: median(used.map((version) => version.size.width)), decimals: 1 }),
      height: roundTo({ value: median(heights), decimals: 1 }),
      depth: roundTo({ value: median(used.map((version) => version.size.depth)), decimals: 1 }),
    },
    source,
    versionsUsed: used.length,
    versionsWithDimensions: measured.length,
    agreement: roundTo({ value: 1 - Math.min(spread, 1), decimals: 2 }),
  };
}
