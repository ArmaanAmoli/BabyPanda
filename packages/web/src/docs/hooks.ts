// src/docs/hooks.ts
// The three pieces of browser state the docs shell needs: the current route
// from the URL hash, which heading the reader is looking at, and whether the
// viewport is wide enough for the two side columns.

import { useCallback, useEffect, useState } from 'react';

/**
 * Read and write the route from `location.hash`.
 *
 * Hash routing is what makes the site work on GitHub Pages: the file
 * `docs/index.html` is a real static asset, so `/BabyPanda/docs/` and
 * `/BabyPanda/docs/#/cli/commands` are both served without a rewrite rule, and
 * a refresh or a pasted link lands on exactly the same page.
 *
 * A hash that does not start with `#/` is an in-page anchor — the table of
 * contents links to `#some-heading` — so it is reported as "no route" and the
 * current page is left alone. That is what lets the right rail use ordinary
 * anchors and the browser's own scrolling.
 */
export function useHashRoute(fallback: string): [string, (slug: string) => void] {
  const read = useCallback((): string | null => {
    const hash = window.location.hash;
    if (!hash.startsWith('#/')) return null;
    const raw = hash.slice(2);
    return raw === '' ? fallback : raw;
  }, [fallback]);

  const [slug, setSlug] = useState(() => read() ?? fallback);

  useEffect(() => {
    const onHashChange = () => {
      const next = read();
      if (next !== null) setSlug(next);
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, [read]);

  const navigate = useCallback((next: string) => {
    if (window.location.hash === `#/${next}`) {
      setSlug(next);
      return;
    }
    window.location.hash = `#/${next}`;
  }, []);

  return [slug, navigate];
}

/**
 * Which of `ids` is currently the closest heading above the fold.
 *
 * A scroll listener rather than an IntersectionObserver: the rail highlights
 * the section the reader is *in*, and the last heading whose top has passed
 * the sticky bar is a more faithful answer than an intersection ratio when
 * sections are shorter than the viewport.
 */
export function useScrollSpy(ids: string[]): string {
  const [active, setActive] = useState(ids[0] ?? '');

  useEffect(() => {
    if (ids.length === 0) return;

    let frame = 0;
    const measure = () => {
      frame = 0;
      // The sticky top bar is 57px tall; leave a little room below it.
      const threshold = 90;
      let current = ids[0];
      for (const id of ids) {
        const element = document.getElementById(id);
        if (!element) continue;
        if (element.getBoundingClientRect().top <= threshold) current = id;
      }
      // At the very bottom the last section wins, even if its heading sits
      // below the threshold.
      if (window.innerHeight + window.scrollY >= document.body.scrollHeight - 4) {
        current = ids[ids.length - 1];
      }
      setActive(current);
    };

    const onScroll = () => {
      if (frame !== 0) return;
      frame = window.requestAnimationFrame(measure);
    };

    measure();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (frame !== 0) window.cancelAnimationFrame(frame);
    };
  }, [ids]);

  return active;
}

/** Whether a media query currently matches. */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window === 'undefined' ? false : window.matchMedia(query).matches,
  );

  useEffect(() => {
    const list = window.matchMedia(query);
    const onChange = () => setMatches(list.matches);
    onChange();
    list.addEventListener('change', onChange);
    return () => list.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}

/**
 * Copy text to the clipboard, with the `execCommand` fallback for contexts
 * where the async API is unavailable (a non-HTTPS origin, mostly).
 */
export async function copyText(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    return;
  } catch {
    // Fall through to the legacy path below.
  }
  const area = document.createElement('textarea');
  area.value = text;
  area.style.position = 'fixed';
  area.style.opacity = '0';
  document.body.appendChild(area);
  area.select();
  document.execCommand('copy');
  document.body.removeChild(area);
}
