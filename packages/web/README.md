# web

The BabyPanda landing page: a React + TypeScript + Vite single-page app styled
with Tailwind CSS v4. It lives in this Bun workspace monorepo as the `web`
package, so all dependency management and script running go through Bun —
there is no npm lockfile here.

## Commands

Run these from the repository root:

```bash
# Install every workspace dependency (updates the root bun.lock)
bun install

# Start the dev server
bun run --filter web dev

# Type-check
bun run --filter web type-check

# Lint (oxlint, configured in .oxlintrc.json)
bun run --filter web lint

# Production build (outputs to packages/web/dist)
bun run --filter web build

# Preview the production build locally
bun run --filter web preview
```

Or from this directory (`packages/web`):

```bash
bun run dev
bun run build
```

## Managing dependencies

Use Bun, not npm, so versions stay in sync with the root `bun.lock`:

```bash
bun add --filter web <package>        # add a dependency
bun add -d --filter web <package>     # add a dev dependency
bun remove --filter web <package>     # remove a dependency
```

## Structure

- `index.html` — entry HTML for the landing page (loads `/src/main.tsx`)
- `docs/index.html` — entry HTML for the documentation site (loads `/src/docs/main.tsx`)
- `src/main.tsx`, `src/App.tsx` — React entry point and page layout
- `src/components/` — page sections (Hero, TerminalDemo, Features, Stack, Install)
- `src/content.ts` — every string, link, and list rendered on the page
- `src/index.css` — Tailwind v4 import and theme
- `src/theme.ts` — the design tokens and URL helpers shared by both entries
- `src/docs/` — the documentation site (see below)
- `vite.config.ts` — Vite config (React + Tailwind plugins, `@` → `src` alias, two entries)

## The documentation site

`docs/index.html` is a second Vite entry, so the production build emits
`dist/index.html` (the landing page) and `dist/docs/index.html` (the docs).
Both are static files, which is what lets them be served from a GitHub Pages
sub-path with no server-side routing: the docs use **hash routing**
(`/BabyPanda/docs/#/cli/commands`), so a refresh or a pasted link lands on the
same page.

```
src/docs/
  types.ts          the Block / DocPage content model
  navigation.ts     sidebar groups, the tab row, and the reading order
  index.ts          every page, the table of contents, and the search index
  markdown.ts       the inline grammar and the "Copy page" serialiser
  highlight.ts      the small syntax highlighter
  hooks.ts          hash routing, scroll-spy, media queries, clipboard
  docs.css          the few rules a utility class cannot express
  pages/*.ts        one file per page — add a page by adding a file
  components/       TopBar, Sidebar, TableOfContents, Blocks, CodeBlock,
                    CopyPageButton, SearchModal, DocsApp
```

Content is authored as typed data rather than Markdown: the web package has no
Markdown toolchain, and a typed block model gives the renderer, the search
index and the "Copy page" button one shared source without pulling in a parser.
To add a page, add a file under `src/docs/pages` and list its slug in
`src/docs/navigation.ts`.

The design tokens live in `src/index.css` (`@theme`) and are mirrored for
JavaScript consumers in `src/theme.ts`. Do not introduce a new palette or a new
typeface.
