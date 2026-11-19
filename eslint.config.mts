import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import pluginReact from 'eslint-plugin-react';
import { defineConfig } from 'eslint/config';
import eslintConfigPrettier from 'eslint-config-prettier';

export default defineConfig([
  {
    files: ['**/*.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    plugins: { js },
    extends: ['js/recommended'],
    languageOptions: { globals: globals.node },
  },
  tseslint.configs.recommended,
  pluginReact.configs.flat.recommended,
  {
    // packages/web uses the automatic JSX runtime ("jsx": "react-jsx"), so
    // components do not import React just to use JSX.
    files: ['packages/web/**/*.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    rules: { 'react/react-in-jsx-scope': 'off' },
  },
  { ignores: ['**/dist/**', '**/node_modules/**'] },
  eslintConfigPrettier,
]);
