// Shared Prettier config for the whole monorepo.
//
//   import config from '@board-games/config/prettier';
//   export default config;

/** @type {import("prettier").Config} */
export default {
  semi: true,
  singleQuote: true,
  trailingComma: 'all',
  printWidth: 100,
  tabWidth: 2,
};
