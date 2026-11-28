// src/docs/components/TopBar.tsx
// The sticky header: wordmark on the left, search in the middle, the tab row
// underneath. Below the tablet breakpoint the search field collapses to an
// icon and a hamburger opens the sidebar as a drawer.

import { Menu, Search } from 'lucide-react';
import { docsAssetUrl, siteRoot } from '@/theme';
import { DOC_TABS } from '../navigation';
import type { DocTab } from '../types';

export interface TopBarProps {
  tab: DocTab;
  onTabChange: (tab: DocTab) => void;
  onOpenSearch: () => void;
  onOpenDrawer: () => void;
}

export function TopBar({ tab, onTabChange, onOpenSearch, onOpenDrawer }: TopBarProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-rule bg-bg/90 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-[1440px] items-center gap-3 px-4 sm:px-6">
        <button
          type="button"
          onClick={onOpenDrawer}
          aria-label="Open navigation"
          className="-ml-1 rounded-sm p-1.5 text-muted transition-colors hover:text-ink lg:hidden"
        >
          <Menu size={18} aria-hidden="true" />
        </button>

        <a href={siteRoot()} className="flex items-center gap-2.5">
          <img
            src={docsAssetUrl('icons/panda-symbol.svg')}
            alt=""
            aria-hidden="true"
            className="h-6 w-6 shrink-0"
          />
          <span className="text-[15px] font-bold tracking-tight text-ink">BabyPanda</span>
          <span className="hidden text-[13px] font-medium text-faint sm:inline">Docs</span>
        </a>

        <div className="flex-1" />

        <button
          type="button"
          onClick={onOpenSearch}
          className="flex items-center gap-2 rounded-md border border-rule bg-surface px-2.5 py-1.5 text-left transition-colors hover:border-border sm:w-64"
        >
          <Search size={14} className="shrink-0 text-faint" aria-hidden="true" />
          <span className="hidden flex-1 text-[13px] text-faint sm:inline">Search…</span>
          <kbd className="hidden shrink-0 rounded-sm border border-rule px-1.5 py-0.5 font-mono text-[10px] text-faint sm:inline">
            Ctrl K
          </kbd>
        </button>
      </div>

      <nav aria-label="Documentation sections" className="mx-auto max-w-[1440px] px-4 sm:px-6">
        <ul className="flex gap-1">
          {DOC_TABS.map((entry) => {
            const active = entry.id === tab;
            return (
              <li key={entry.id}>
                <button
                  type="button"
                  onClick={() => onTabChange(entry.id)}
                  aria-current={active ? 'page' : undefined}
                  className={`relative px-3 py-2.5 text-[13px] font-medium transition-colors ${
                    active ? 'text-ink' : 'text-muted hover:text-ink'
                  }`}
                >
                  {entry.label}
                  {active && (
                    <span
                      aria-hidden="true"
                      className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-accent"
                    />
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
    </header>
  );
}
