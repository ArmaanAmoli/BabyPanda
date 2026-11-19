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

- `index.html` — entry HTML (loads `/src/main.tsx`)
- `src/main.tsx`, `src/App.tsx` — React entry point and page layout
- `src/components/` — page sections (Hero, TerminalDemo, Features, Stack, Install)
- `src/content.ts` — every string, link, and list rendered on the page
- `src/index.css` — Tailwind v4 import and theme
- `vite.config.ts` — Vite config (React + Tailwind plugins, `@` → `src` alias)
