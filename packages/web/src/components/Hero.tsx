import { content } from '@/content';

export default function Hero() {
  const { hero, site } = content;
  return (
    <section className="mx-auto w-full max-w-5xl px-5 pt-12 pb-14 sm:pt-16 sm:pb-20">
      <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-accent sm:text-xs">
        {site.tagline}
      </p>
      <h1 className="mt-5 max-w-3xl text-4xl font-bold leading-[1.04] tracking-tight text-ink sm:text-6xl">
        {hero.headline}
      </h1>
      <p className="mt-5 max-w-xl text-base leading-relaxed text-ink/65 sm:text-lg">
        {hero.subhead}
      </p>
      <div className="mt-8 flex flex-wrap items-center gap-3">
        <a
          href={hero.primaryCta.href}
          className="rounded-sm bg-accent px-5 py-2.5 font-mono text-sm font-semibold text-bg transition-colors hover:bg-ink"
        >
          {hero.primaryCta.label}
        </a>
        <a
          href={hero.secondaryCta.href}
          className="rounded-sm border border-ink/25 px-5 py-2.5 font-mono text-sm text-ink/85 transition-colors hover:border-ink/60 hover:text-ink"
        >
          {hero.secondaryCta.label}
        </a>
      </div>
      {hero.image && (
        <div className="mt-12">
          <img
            src={hero.image.src}
            alt={hero.image.alt}
            className="w-full max-w-[1200px] mx-auto h-auto rounded-xl border border-ink/15 shadow-xl"
          />
        </div>
      )}
    </section>
  );
}
