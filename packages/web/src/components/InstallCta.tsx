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
      {/* Translucent + lightly blurred so the dot field shows through and the
          card reads as part of the banner, not a slab on top of it. */}
      <div className="pointer-events-auto w-full max-w-4xl rounded-lg border border-ink/15 bg-bg/40 px-6 py-5 backdrop-blur-[3px]">
        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-accent sm:text-xs">
          {install.ctaLabel}
        </p>
        <p className="mt-1 text-xs text-ink/55 sm:text-sm">{step.label}</p>
        <div className="relative mt-2.5 overflow-hidden rounded-md border border-ink/10 bg-bg/50">
          <pre className="overflow-x-auto px-4 py-3 pr-12 font-mono text-[12px] leading-6 text-ink sm:text-[13px]">
            <code>{step.command}</code>
          </pre>
          <button
            type="button"
            onClick={copy}
            aria-label={`Copy command: ${step.command}`}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-sm border border-ink/15 bg-bg p-1.5 text-ink/60 transition-colors hover:border-ink/40 hover:text-ink"
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
