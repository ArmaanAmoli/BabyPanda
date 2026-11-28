// src/docs/components/CopyPageButton.tsx
// The "Copy page" control beside the title: puts the page's Markdown on the
// clipboard, so a reader can paste it into an issue or a pull request.

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { pageToMarkdown } from '../markdown';
import { copyText } from '../hooks';
import type { DocPage } from '../types';

export function CopyPageButton({ page }: { page: DocPage }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await copyText(pageToMarkdown(page));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  return (
    <button
      type="button"
      onClick={copy}
      className="flex shrink-0 items-center gap-1.5 rounded-md border border-rule bg-surface px-2.5 py-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-muted transition-colors hover:border-border hover:text-ink"
    >
      {copied ? (
        <Check size={13} className="text-accent" aria-hidden="true" />
      ) : (
        <Copy size={13} aria-hidden="true" />
      )}
      {copied ? 'Copied' : 'Copy page'}
    </button>
  );
}
