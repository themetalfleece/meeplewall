/** A rating out of 10 as BGG shows it: `8`, `7.5`. */
export function formatRating(rating: number): string {
  return Number.isInteger(rating) ? String(rating) : rating.toFixed(1);
}

/** A range such as `2 to 4 players`, collapsing equal ends, or null when both are unknown. */
export function formatRange({
  min,
  max,
  unit,
}: {
  min: number | null;
  max: number | null;
  unit: string;
}): string | null {
  const ends = [min, max].filter((end) => end !== null);
  if (ends.length === 0) {
    return null;
  }

  const low = Math.min(...ends);
  const high = Math.max(...ends);

  return low === high ? `${low} ${unit}` : `${low} to ${high} ${unit}`;
}

/** BGG's 1 to 5 complexity weight, to two decimals. */
export function formatWeight(weight: number): string {
  return `${weight.toFixed(2)} / 5`;
}

/** A count as people read it: `12,345`. */
export function formatCount(count: number): string {
  return new Intl.NumberFormat('en-GB').format(count);
}
