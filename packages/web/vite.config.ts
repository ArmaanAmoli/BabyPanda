import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const packageDir = path.dirname(fileURLToPath(import.meta.url));
const srcDir = path.resolve(packageDir, 'src');

export default defineConfig({
  // Relative base so the production build works on GitHub Pages under any repo name.
  base: './',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': srcDir,
    },
  },
  build: {
    rollupOptions: {
      // Two entries: the landing page at the site root, and the documentation
      // site at /docs/. Keeping them separate means the landing bundle never
      // carries the docs, and each HTML file gets asset URLs relative to where
      // it is served from.
      input: {
        index: path.resolve(packageDir, 'index.html'),
        docs: path.resolve(packageDir, 'docs/index.html'),
      },
    },
  },
});
