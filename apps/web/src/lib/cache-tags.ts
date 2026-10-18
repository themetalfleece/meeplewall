/** Tags every cached read of one game, so the revalidate route can expire them together. */
export function gameCacheTag(bggId: number): string {
  return `game:${bggId}`;
}
