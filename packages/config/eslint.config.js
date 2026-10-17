// Shared, framework-agnostic ESLint flat config for the whole monorepo.
//
// Consumers re-export it from their own eslint.config.js:
//
//   import config from '@board-games/config/eslint';
//   export default config;
//
// The strict-type rules below are ON from day one and are non-negotiable: no
// `any`, no unsafe operations on untyped values, and no `as` casts. Parse
// unknown data at boundaries with a schema (Zod / Valibot) and use the parser's
// output type instead of asserting.
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/build/**',
      '**/.next/**',
      '**/node_modules/**',
      '**/coverage/**',
      '**/*.generated.*',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        // Auto-discovers the nearest tsconfig per file, so there is no need to
        // enumerate project paths, and it works uniformly across every package.
        projectService: true,
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unsafe-assignment': 'error',
      '@typescript-eslint/no-unsafe-call': 'error',
      '@typescript-eslint/no-unsafe-member-access': 'error',
      '@typescript-eslint/no-unsafe-return': 'error',
      '@typescript-eslint/no-unsafe-argument': 'error',
      // Blocks `as X` casts entirely. Use schema parsing at boundaries instead.
      '@typescript-eslint/consistent-type-assertions': ['error', { assertionStyle: 'never' }],
    },
  },
  {
    // Plain JS/config files are not part of a typed project, so type-aware
    // linting is turned off for them (it would otherwise demand a tsconfig).
    files: ['**/*.{js,cjs,mjs}'],
    extends: [tseslint.configs.disableTypeChecked],
    languageOptions: {
      parserOptions: { projectService: false },
    },
  },
  // Keep ESLint out of Prettier's way. Must stay last.
  prettier,
);
