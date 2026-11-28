// src/docs/components/DocsApp.tsx
// The documentation shell: top bar, sidebar, centre column, right rail, and
// the search palette. Everything above the `lg` breakpoint collapses into a
// drawer, and the right rail is hidden below `xl`.

import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { DOC_HOME_SLUG, getPage, neighbours, tableOfContents } from '../index';
import { firstPageOfTab, tabForSlug } from '../navigation';
import { useHashRoute } from '../hooks';
import type { DocTab } from '../types';
import { TopBar } from './TopBar';
import { Sidebar } from './Sidebar';
import { TableOfContents } from './TableOfContents';
import { Blocks } from './Blocks';
import { CopyPageButton } from './CopyPageButton';
import { SearchModal } from './SearchModal';

export function DocsApp() {
  const [slug, navigate] = useHashRoute(DOC_HOME_SLUG);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  const page = getPage(slug) ?? getPage(DOC_HOME_SLUG);
  const activeSlug = page?.slug ?? DOC_HOME_SLUG;

  // The tab is derived from the page rather than stored, so the two can never
  // disagree: reading a Reference page selects the Reference tab, and clicking
  // a tab moves to that tab's first page.
  const tab = tabForSlug(activeSlug);

  const changeTab = useCallback(
    (next: DocTab) => {
      if (tabForSlug(activeSlug) !== next) navigate(firstPageOfTab(next));
    },
    [activeSlug, navigate],
  );

  // Document title follows the page, so a bookmark names the page.
  useEffect(() => {
    document.title = page ? `${page.title} · BabyPanda Docs` : 'BabyPanda Docs';
  }, [page]);

  // Ctrl/Cmd+K opens search; Escape closes whatever is open.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'k' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setSearchOpen(true);
        return;
      }
      if (event.key === 'Escape') {
        if (searchOpen) setSearchOpen(false);
        else if (drawerOpen) setDrawerOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [searchOpen, drawerOpen]);

  // A new page starts at the top, unless it carries an in-page anchor.
  useEffect(() => {
    if (window.location.hash.startsWith('#/')) window.scrollTo(0, 0);
  }, [activeSlug]);

  if (!page) return null;

  const toc = tableOfContents(page);
  const { previous, next } = neighbours(activeSlug);

  const goTo = (target: string) => {
    setDrawerOpen(false);
    navigate(target);
  };

  return (
    <div className="min-h-screen bg-bg font-sans text-ink">
      <TopBar
        tab={tab}
        onTabChange={changeTab}
        onOpenSearch={() => setSearchOpen(true)}
        onOpenDrawer={() => setDrawerOpen(true)}
      />

      <div className="mx-auto flex max-w-[1440px] items-start">
        <Sidebar activeSlug={activeSlug} onNavigate={goTo} tab={tab} variant="column" />

        <main className="min-w-0 flex-1">
          <article className="docs-body mx-auto max-w-[720px] px-5 py-10 sm:px-8">
            <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-accent">
              {page.category}
            </p>
            <div className="mt-3 flex items-start justify-between gap-4">
              <h1 className="text-[34px] font-bold leading-[1.1] tracking-tight text-ink sm:text-[40px]">
                {page.title}
              </h1>
              <CopyPageButton page={page} />
            </div>
            <p className="mt-3 text-[15px] leading-7 text-muted">{page.subtitle}</p>

            <Blocks blocks={page.blocks} />

            <nav
              aria-label="Previous and next page"
              className="mt-14 grid gap-3 border-t border-rule pt-6 sm:grid-cols-2"
            >
              {previous ? (
                <a
                  href={`#/${previous.slug}`}
                  onClick={(event) => {
                    event.preventDefault();
                    goTo(previous.slug);
                  }}
                  className="group rounded-lg border border-rule px-4 py-3 transition-colors hover:border-border hover:bg-surface"
                >
                  <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-faint">
                    <ArrowLeft size={11} aria-hidden="true" />
                    Previous
                  </span>
                  <span className="mt-1 block text-[14px] font-medium text-ink">
                    {previous.title}
                  </span>
                </a>
              ) : (
                <span />
              )}
              {next ? (
                <a
                  href={`#/${next.slug}`}
                  onClick={(event) => {
                    event.preventDefault();
                    goTo(next.slug);
                  }}
                  className="group rounded-lg border border-rule px-4 py-3 text-right transition-colors hover:border-border hover:bg-surface sm:col-start-2"
                >
                  <span className="flex items-center justify-end gap-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-faint">
                    Next
                    <ArrowRight size={11} aria-hidden="true" />
                  </span>
                  <span className="mt-1 block text-[14px] font-medium text-ink">{next.title}</span>
                </a>
              ) : null}
            </nav>
          </article>
        </main>

        <TableOfContents entries={toc} />
      </div>

      {drawerOpen && (
        <Sidebar
          activeSlug={activeSlug}
          onNavigate={goTo}
          tab={tab}
          variant="drawer"
          onClose={() => setDrawerOpen(false)}
        />
      )}

      {searchOpen && (
        <SearchModal
          onClose={() => setSearchOpen(false)}
          onNavigate={(target, anchor) => {
            setDrawerOpen(false);
            navigate(target);
            if (anchor !== '') {
              // The heading only exists once the new page has rendered.
              window.setTimeout(() => {
                document.getElementById(anchor)?.scrollIntoView();
              }, 60);
            }
          }}
        />
      )}
    </div>
  );
}
