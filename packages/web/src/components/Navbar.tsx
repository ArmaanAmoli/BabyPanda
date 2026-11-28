import { assetUrl, docsUrl, siteRoot } from '@/theme';

// The landing page's navbar.
//
// The page used to have no navbar at all: its navigation was the halftone dot
// banner's small uppercase link columns, which are easy to miss. This bar keeps
// that banner exactly as it is and simply puts a wordmark and one unmistakable
// call to action above it.
//
// It is `sticky`, and because it is the first element in the document its
// in-flow position already is the top of the viewport — so it never covers the
// banner while the page is at rest, it only pins itself once you scroll past.
export default function Navbar() {
  return (
    <header className="sticky top-0 z-30 border-b border-rule bg-bg/90 backdrop-blur-md">
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center gap-3 px-5">
        <a href={siteRoot()} className="flex items-center gap-2.5">
          <img
            src={assetUrl('icons/panda-symbol.svg')}
            alt=""
            aria-hidden="true"
            className="h-6 w-6 shrink-0"
          />
          <span className="text-[15px] font-bold tracking-tight text-ink">BabyPanda</span>
        </a>

        <div className="flex-1" />

        <a
          href={docsUrl()}
          className="rounded-md bg-accent px-3.5 py-1.5 text-[13px] font-semibold text-bg transition-opacity hover:opacity-90"
        >
          Docs
        </a>
      </div>
    </header>
  );
}
