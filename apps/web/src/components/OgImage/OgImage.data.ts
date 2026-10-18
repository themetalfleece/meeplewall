import type { CollectionSummary } from '@/lib/collections';

/** The words on a collection's social image. */
export function collectionOgText({
  summary,
  username,
}: {
  summary: CollectionSummary | null;
  username: string | null;
}): { title: string; subtitle: string | null } {
  if (summary !== null) {
    const count = summary.itemCount === 1 ? '1 board game' : `${summary.itemCount} board games`;
    return { title: `${summary.displayName}'s collection`, subtitle: count };
  }
  if (username !== null) {
    return { title: `${username}'s collection`, subtitle: null };
  }

  return { title: 'Collection not found', subtitle: null };
}
