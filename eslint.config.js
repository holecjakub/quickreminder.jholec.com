import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig(
  { ignores: ['dist', 'playwright-report', 'test-results', 'docs'] },
  js.configs.recommended,
  tseslint.configs.recommended,
  reactHooks.configs.flat.recommended,
  {
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
  },
  // Import boundaries (contracts §1).
  {
    files: ['src/recreation/**'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [{
          group: ['**/app', '**/app/**', '**/desktop', '**/desktop/**'],
          message: 'recreation/ is self-contained (contracts §1).',
        }],
      }],
    },
  },
  {
    files: ['src/desktop/**'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [{
          group: ['**/app', '**/app/**', '**/recreation/*', '!**/recreation/index'],
          message: 'desktop/ imports only the recreation public surface (recreation/index.ts).',
        }],
      }],
    },
  },
);
