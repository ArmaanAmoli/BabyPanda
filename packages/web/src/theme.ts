// src/theme.ts
// The web package's design tokens and URL helpers, for the JavaScript side.
//
// `src/index.css` is the source of truth for CSS: it declares the same values
// in Tailwind v4's `@theme` block so they are available as utilities
// (`bg-bg`, `text-ink`, `border-border`, …). This file exists because some
// consumers need real colour values rather than a class name — the halftone
// banner parses its palette as hex to do canvas maths — and because both
// entries need the same answer to "where is the site root?".
//
// Keep the two in sync. Everything here is derived from the three brand
// colours; nothing introduces a new hue or a new typeface.

/** The three brand colours the whole site is built from. */
export const BRAND = {
  /** Page background: panda black. */
  bg: '#0b0b0a',
  /** Primary text: warm off-white. */
  ink: '#f1efe8',
  /** The single accent: bamboo green. */
  accent: '#8fd16a',
} as const;

/** Surfaces, as the page used them before they were named. */
export const SURFACE = {
  /** Raised surface: code chips, callouts, the search modal. */
  raised: '#141412',
  /** Hovered / active surface: sidebar rows, table stripes. */
  raisedStrong: '#1c1c19',
} as const;

/** Font stacks, mirroring `--font-sans` / `--font-mono` in index.css. */
export const FONT = {
  sans: "'Montserrat', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
  mono: "ui-monospace, 'SF Mono', 'Cascadia Mono', Menlo, Consolas, 'Liberation Mono', monospace",
} as const;

/**
 * Vite replaces `import.meta.env.BASE_URL` at build time. The `|| '/'` keeps
 * the module loadable outside a Vite build (a unit test, say) rather than
 * producing the string "undefined".
 */
const BASE_URL: string = import.meta.env.BASE_URL || '/';

/**
 * The base as an absolute URL, anchored at the document that is running.
 *
 * `new URL(relative, base)` needs an absolute base, and a bare pathname is not
 * one — so every helper below resolves through `document.baseURI` rather than
 * through a path string.
 */
function anchor(): URL {
  return new URL(BASE_URL, document.baseURI);
}

/** Resolve a relative path against an absolute URL, and return the path. */
function resolveAgainst(relative: string, base: URL): string {
  return new URL(relative, base).pathname;
}

/**
 * The deployed base path of *this* document, always with a trailing slash.
 *
 * The build uses `base: './'` so one artefact works under any repository name,
 * which means the base is only meaningful once it is resolved against the URL
 * the document was actually served from.
 */
export function baseUrl(): string {
  return anchor().pathname;
}

/**
 * The site root: one level above the documentation entry.
 *
 * The landing page is served from the root (`/BabyPanda/`) and the
 * documentation from `/BabyPanda/docs/`, so the docs entry sits exactly one
 * directory below everything in `public/`. Only the docs entry needs this.
 *
 * In a production build the answer comes from the chunk's own URL: every
 * bundle lands in `<root>/assets/`, which is one level below the root and —
 * unlike the document URL — never depends on a trailing slash. In dev the
 * modules are served from `/src/…`, so the configured base is used instead.
 */
export function siteRoot(): string {
  if (BASE_URL.startsWith('.')) {
    return new URL('..', new URL('.', import.meta.url)).pathname;
  }
  const base = anchor();
  // A site deployed at the domain root has nothing above it, and
  // `new URL('..', '/')` throws rather than returning '/'.
  if (base.pathname === '/') return '/';
  return new URL('..', base).pathname;
}

/** A file from `public/`, for the landing page. */
export function assetUrl(path: string): string {
  const cleaned = path.replace(/^\//, '');
  return cleaned === '' ? baseUrl() : resolveAgainst(cleaned, anchor());
}

/** A file from `public/`, for the documentation entry. */
export function docsAssetUrl(path: string): string {
  const cleaned = path.replace(/^\//, '');
  if (cleaned === '') return siteRoot();
  return resolveAgainst(cleaned, new URL(siteRoot(), document.baseURI));
}

/**
 * The documentation entry point, as an absolute path.
 *
 * Called from the landing page's content, where the document *is* the site
 * root — the docs entry must not use this, because its own base is already
 * `/docs/`.
 */
export function docsUrl(): string {
  return resolveAgainst('docs/', anchor());
}
