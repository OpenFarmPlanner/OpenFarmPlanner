import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  // ESLint 10 no longer implicitly skips every dotfolder/build-cache
  // directory the way earlier versions did — `.vite`'s prebundled deps
  // (@mui_material.js etc.) started getting linted as plain JS and failing
  // with "rule not found" errors for rules this config never enables.
  // List every local build/tooling output explicitly instead of relying on
  // implicit defaults that can change across major versions.
  globalIgnores(['dist', 'dist-staging', 'dist-ssr', '.vite', 'coverage', 'mutation-report']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    rules: {
      // Tooltips must go through AppTooltip so they hide themselves while a
      // context menu is open (see components/contextMenu/contextMenuOpenState.ts).
      // MUI's Tooltip has no idea about app context menus and would cover them.
      'no-restricted-imports': ['error', {
        paths: [
          {
            name: '@mui/material',
            importNames: ['Tooltip'],
            message: "Use AppTooltip from 'components/AppTooltip' instead - it hides tooltips while a context menu is open.",
          },
          {
            name: '@mui/material/Tooltip',
            message: "Use AppTooltip from 'components/AppTooltip' instead - it hides tooltips while a context menu is open.",
          },
        ],
      }],
    },
  },
  {
    // AppTooltip is the one place allowed to build on MUI's Tooltip.
    files: ['src/components/AppTooltip.tsx'],
    rules: {
      'no-restricted-imports': 'off',
    },
  },
  {
    // Vendored from react-modern-gantt (see src/gantt-chart/README.md), which
    // was linted under its own, more lenient rule set. Keep that leniency
    // scoped to this directory instead of rewriting its switch statements.
    files: ['src/gantt-chart/**/*.{ts,tsx}'],
    rules: {
      'no-case-declarations': 'warn',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
])
