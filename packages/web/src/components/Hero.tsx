import { content } from '@/content';

export default function Hero() {
  const { hero, site } = content;
  return (
    <section className="mx-auto w-full max-w-5xl px-5 pt-10 pb-10 sm:pt-12 sm:pb-12">
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-accent sm:text-xs">
        {site.tagline}
      </p>
      <h1 className="mt-5 max-w-3xl text-4xl font-bold leading-[1.04] tracking-tight text-ink sm:text-6xl">
        {hero.headline}
      </h1>
      {hero.image && (
        <div className="mt-10">
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
