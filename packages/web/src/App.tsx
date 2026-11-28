import { useEffect } from 'react';
import Hero from '@/components/Hero';
import Demo from '@/components/Demo';
import Showcase from '@/components/Showcase';
import InstallCta from '@/components/InstallCta';
import HalftoneWordmarkFooter from '@/components/ui/halftone-wordmark-footer';
import { content } from '@/content';
import { BRAND } from '@/theme';

export default function App() {
  // Document title and meta description come from content.site at runtime.
  useEffect(() => {
    document.title = content.site.name;
    document
      .querySelector('meta[name="description"]')
      ?.setAttribute('content', content.site.description);
  }, []);

  return (
    <div className="min-h-screen bg-bg font-sans text-ink">
      {/* The halftone dots banner opens the page; its link columns act as the
          navigation, so there is no separate navbar. w-full is required:
          without it the canvas collapses to 0px. The relative wrapper hosts
          the hovering install card over the banner's empty middle, and carries
          the #install anchor so the hero CTA scrolls here. */}
      <div id="install" className="relative w-full">
        <HalftoneWordmarkFooter
          wordmark={content.footer.wordmark}
          label={content.footer.label}
          meta=""
          columns={content.footer.columns}
          backToTop={false}
          height="700px"
          crop={0.15}
          dotGap={5.5}
          palette={{ background: BRAND.bg, ink: BRAND.ink, warm: BRAND.accent }}
        />
        <InstallCta />
      </div>
      <main>
        <Hero />
        <Demo />
        <Showcase />
      </main>
      {/* Copyright and licence line at the very end of the page. */}
      <footer className="border-t border-rule">
        <p className="mx-auto w-full max-w-5xl px-5 py-6 text-[11px] font-medium uppercase tracking-[0.18em] text-faint">
          {content.footer.meta}
        </p>
      </footer>
    </div>
  );
}
