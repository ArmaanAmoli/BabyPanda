import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { content } from '@/content';

// Hovering card laid over the empty middle of the halftone dot banner at the
// top of the page. Rendered inside a `relative` wrapper in App.tsx; the outer
// overlay is pointer-events-none so the canvas dots still react to the
// pointer everywhere except on the card itself.
export default function InstallCta() {
  const { install } = content;
  const step = install.steps[0];
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(step.command);
    } catch {
      // Fallback for non-secure contexts where the clipboard API is unavailable.
      const ta = document.createElement('textarea');
      ta.value = step.command;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  return (
    <div className="pointer-events-none absolute inset-0 z-[2] flex items-center justify-center px-4">
      {/* Translucent + lightly blurred, no border, so the dot field shows
          through and the card reads as part of the banner. */}
      <div className="pointer-events-auto w-full max-w-6xl rounded-lg bg-bg/40 px-6 py-5 backdrop-blur-[3px]">
        <div className="relative overflow-hidden rounded-md border border-rule bg-bg/50">
          {/* The command is the one text that stays mono: the UA stylesheet
              forces monospace on pre/code, so font-mono is set explicitly.
              text-sm only from xl up: the 119-char command needs ~1000px at
              14px, which the max-w-6xl card provides; below xl the 12px size
              keeps it on one line, so overflow-x-auto never engages on
              desktop widths and no scrollbar appears. */}
          <pre className="overflow-x-auto px-4 py-3 pr-12 font-mono text-xs font-medium leading-6 text-ink xl:text-sm">
            <code>{step.command}</code>
          </pre>
          <button
            type="button"
            onClick={copy}
            aria-label={`Copy command: ${step.command}`}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-sm border border-border bg-bg p-1.5 text-muted transition-colors hover:border-border-strong hover:text-ink"
          >
            {copied ? (
              <Check size={14} className="text-accent" aria-hidden="true" />
            ) : (
              <Copy size={14} aria-hidden="true" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
