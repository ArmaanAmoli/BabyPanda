// src/docs/main.tsx
// The documentation entry point. It is a separate Vite entry from the landing
// page (see vite.config.ts), so the landing bundle never carries the docs.

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../index.css';
import './docs.css';
import { DocsApp } from './components/DocsApp';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <DocsApp />
  </StrictMode>,
);
