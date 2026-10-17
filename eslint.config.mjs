// Flat config ESLint 10.
// File ini .mjs karena root package.json bukan "type": "module".
import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      'coverage/**',
      'drizzle/**',
      '.serena/**',
      'pnpm-lock.yaml',
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  // Lingkungan: Node untuk backend/konfigurasi, browser untuk frontend.
  {
    files: ['apps/api/**/*.ts', 'packages/**/*.ts', '*.config.ts', 'drizzle.config.ts'],
    languageOptions: { globals: { ...globals.node } },
  },
  {
    files: ['apps/web/src/**/*.{ts,tsx}'],
    languageOptions: { globals: { ...globals.browser } },
  },
  {
    files: ['*.mjs', '**/*.config.{js,mjs,ts}'],
    languageOptions: { globals: { ...globals.node } },
  },

  // Aturan yang butuh informasi tipe. Dibatasi ke kode sumber yang memang
  // tercakup tsconfig, supaya file konfigurasi tidak membuat parser protes.
  {
    files: ['apps/*/src/**/*.{ts,tsx}', 'packages/*/src/**/*.ts'],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
    },
  },

  // React Hooks hanya relevan di frontend.
  {
    files: ['apps/web/src/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    rules: { ...reactHooks.configs.recommended.rules },
  },

  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      // Handler Fastify memang async tanpa perlu await.
      '@typescript-eslint/require-await': 'off',
    },
  },
);
