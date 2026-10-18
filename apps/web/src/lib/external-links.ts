/** Where removal requests and legal questions go. */
export const LEGAL_EMAIL = 'legal@meeplewall.com';

/** Links out of the site, kept in one place so a moved URL is one edit. */
export const externalLinks = {
  bggHome: 'https://boardgamegeek.com',
  bggGame: (bggId: number) => `https://boardgamegeek.com/boardgame/${bggId}`,
  bggPrivacy: 'https://boardgamegeek.com/privacy',
  bggXmlApiTerms: 'https://boardgamegeek.com/wiki/page/XML_API_Terms_of_Use',
  sourceCode: 'https://github.com/themetalfleece/board-games',
  legalEmail: `mailto:${LEGAL_EMAIL}`,
};
