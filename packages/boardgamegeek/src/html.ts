const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  quot: '"',
  apos: "'",
  lt: '<',
  gt: '>',
  nbsp: ' ',
  mdash: String.fromCodePoint(0x2014),
  ndash: String.fromCodePoint(0x2013),
  lsquo: String.fromCodePoint(0x2018),
  rsquo: String.fromCodePoint(0x2019),
  ldquo: String.fromCodePoint(0x201c),
  rdquo: String.fromCodePoint(0x201d),
  hellip: String.fromCodePoint(0x2026),
};

function decodeEntity(entity: string, name: string): string {
  if (name.startsWith('#x')) {
    return String.fromCodePoint(Number.parseInt(name.slice(2), 16));
  }

  if (name.startsWith('#')) {
    return String.fromCodePoint(Number.parseInt(name.slice(1), 10));
  }

  return NAMED_ENTITIES[name] ?? entity;
}

/**
 * Turns a BGG description into plain text: line and paragraph breaks become newlines, every
 * other tag is dropped, and entities are decoded.
 */
export function htmlToPlainText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, decodeEntity)
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
