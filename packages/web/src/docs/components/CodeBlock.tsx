// src/docs/components/CodeBlock.tsx
// A fenced code block: a language label, a copy button, and syntax colouring
// from the tiny highlighter in src/docs/highlight.ts.

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { highlight, TOKEN_CLASS } from '../highlight';
import { copyText } from '../hooks';
import type { CodeLang } from '../types';

export interface CodeBlockProps {
  lang: CodeLang;
  code: string;
  title?: string;
}

export function CodeBlock({ lang, code, title }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const tokens = highlight(code, lang);

  const copy = async () => {
    await copyText(code);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  return (
    <figure className="my-6 overflow-hidden rounded-lg border border-rule bg-surface">
      <figcaption className="flex items-center justify-between gap-3 border-b border-rule px-4 py-2">
        <span className="truncate font-mono text-[11px] uppercase tracking-[0.14em] text-faint">
          {title ?? lang}
        </span>
        <button
          type="button"
          onClick={copy}
          aria-label={copied ? 'Copied' : 'Copy code'}
          className="flex shrink-0 items-center gap-1.5 rounded-sm border border-transparent px-2 py-1 font-mono text-[11px] uppercase tracking-[0.14em] text-faint transition-colors hover:border-border hover:text-ink"
        >
          {copied ? (
            <Check size={13} className="text-accent" aria-hidden="true" />
          ) : (
            <Copy size={13} aria-hidden="true" />
          )}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </figcaption>
      <pre className="docs-scroll overflow-x-auto px-4 py-4 font-mono text-[13px] leading-6 text-ink">
        <code>
          {tokens.map((token, index) => (
            <span key={index} className={TOKEN_CLASS[token.type]}>
              {token.value}
            </span>
          ))}
        </code>
      </pre>
    </figure>
  );
}
