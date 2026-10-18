/** How a collection's size reads in its heading. */
export function describeGameCount(count: number): string {
  return count === 1 ? '1 game' : `${count} games`;
}
