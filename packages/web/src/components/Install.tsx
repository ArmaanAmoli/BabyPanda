import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { content } from '@/content';

export default function Install() {
  const { install } = content;
  const [copied, setCopied] = useState<string | null>(null);

  const copy = async (command: string) => {
    try {
      await navigator.clipboard.writeText(command);
    } catch {
      // Fallback for non-secure contexts where the clipboard API is unavailable.
      const ta = document.createElement('textarea');
      ta.value = command;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCopied(command);
    window.setTimeout(() => setCopied((c) => (c === command ? null : c)), 1600);
  };

  return (
    <section id="install" className="mx-auto w-full max-w-5xl px-5 py-14 sm:py-20">
      <h2 className="font-mono text-xs uppercase tracking-[0.22em] text-ink/50">{install.title}</h2>
      <ol className="mt-6 space-y-4">
        {install.steps.map((step) => (
          <li key={step.command}>
            <p className="mb-1.5 text-sm text-ink/60">{step.label}</p>
            <div className="relative overflow-hidden rounded-md border border-ink/15 bg-ink/[0.03]">
              <pre className="overflow-x-auto px-4 py-3.5 pr-12 font-mono text-[13px] leading-6 text-ink sm:text-sm">
                <code>{step.command}</code>
              </pre>
              <button
                type="button"
                onClick={() => copy(step.command)}
                aria-label={`Copy command: ${step.command}`}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-sm border border-ink/15 bg-bg p-1.5 text-ink/60 transition-colors hover:border-ink/40 hover:text-ink"
              >
                {copied === step.command ? (
                  <Check size={14} className="text-accent" aria-hidden="true" />
                ) : (
                  <Copy size={14} aria-hidden="true" />
                )}
              </button>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
