// src/content.ts
// Every string, link and list rendered on the page lives in this file.
// Components read from `content` and never hard-code copy, URLs or commands.
// Replace every value marked with a trailing `// SAMPLE` comment.

import { assetUrl, docsUrl } from '@/theme';

// Public-folder assets are written root-absolute; `assetUrl` resolves them
// against the deployed base path so they also work under a GitHub Pages
// project subpath (e.g. https://<user>.github.io/<repo>/).
const asset = assetUrl;

/** Site-wide identity: document <title>, meta description, nav brand, halftone banner meta. */
export interface SiteContent {
  /** Product name. Used in the nav brand, the document title and the footer. */
  name: string;
  /** One-line tagline. Shown as the hero eyebrow and folded into the document title. */
  tagline: string;
  /** Meta description for search engines. Keep under ~160 characters. */
  description: string;
  /** URL of the source repository. Used by the nav GitHub icon. */
  githubUrl: string;
  /** Author name. Used in the halftone banner's meta line. */
  authorName: string;
  /** URL of the author's GitHub profile. Used in the halftone banner's link columns. */
  authorGithubUrl: string;
  /** Copyright year. Used in the halftone banner's meta line. */
  year: number;
}

/** One image shown beside section copy. */
export interface SectionImage {
  /** Root-relative URL of the image in the public folder. */
  src: string;
  /** Alt text for the image. */
  alt: string;
}

/** Hero section copy. */
export interface HeroContent {
  /** Big headline. */
  headline: string;
  /** Screenshot shown beside the hero copy. */
  image?: SectionImage;
}

/** Video demo shown in the "See it in action" section. */
export interface DemoContent {
  /** Section heading. */
  title: string;
  /** MP4 video in the public folder, autoplayed muted and looped. */
  video: { src: string };
}

/** One product screenshot shown outside of cards. */
export interface ShowcaseItem {
  /** Root-relative URL of the image in the public folder. */
  src: string;
  /** Alt text for the image. */
  alt: string;
}

/** Product-in-action showcase section. */
export interface ShowcaseContent {
  /** Section heading. */
  title: string;
  /** Screenshots displayed prominently, not inside cards. */
  items: ShowcaseItem[];
}

export interface InstallStep {
  /** The command shown in the code block and copied by the copy button. */
  command: string;
}

export interface InstallContent {
  /** Ordered install steps, each rendered as a code block with a copy button. */
  steps: InstallStep[];
}

export interface FooterLinkItem {
  /** Visible link text. */
  label: string;
  /** Target URL. */
  href: string;
}

export interface FooterColumnItem {
  /** Column heading. */
  title: string;
  /** Links listed under the heading. */
  links: FooterLinkItem[];
}

export interface FooterContent {
  /** Giant dotted wordmark in the halftone banner at the top of the page, cropped by its bottom edge. Lowercase reads best. */
  wordmark: string;
  /** Top-left studio line in the halftone banner. */
  label: string;
  /** Copyright and licence line, rendered at the very end of the page. */
  meta: string;
  /** Link columns along the top of the halftone banner. */
  columns: FooterColumnItem[];
}

/** Root shape of everything the page renders. */
export interface Content {
  site: SiteContent;
  hero: HeroContent;
  demo: DemoContent;
  showcase: ShowcaseContent;
  install: InstallContent;
  footer: FooterContent;
}

export const content: Content = {
  site: {
    name: 'BabyPanda',
    tagline: 'Autonomous coding agent for your terminal',
    description:
      'BabyPanda is a terminal-based autonomous coding agent. Point it at a task, approve its plan, and it edits files, runs tools and tests for you.',
    githubUrl: 'https://github.com/ArmaanAmoli/BabyPanda',
    authorName: 'Armaan Amoli',
    authorGithubUrl: 'https://github.com/ArmaanAmoli',
    year: 2026,
  },
  hero: {
    headline: 'Ship faster with an autonomous coding agent',
    image: {
      src: asset('/images/start-screen.png'),
      alt: 'BabyPanda start screen in the terminal',
    },
  },
  demo: {
    title: 'See it in action',
    video: {
      src: asset('/videos/babypanda-summarize-repo-sample.mp4'),
    },
  },
  showcase: {
    title: 'Built for review, not just automation',
    items: [
      {
        src: asset('/images/diffViewer-screenshot.png'),
        alt: 'Inline diff viewer in the terminal',
      },
      {
        src: asset('/images/command-permission-screenshot.png'),
        alt: 'Command permission prompt in the terminal',
      },
    ],
  },
  install: {
    steps: [
      {
        command:
          'curl -fsSL --connect-timeout 5 --retry 3 https://raw.githubusercontent.com/ArmaanAmoli/BabyPanda/main/install.sh | bash',
      },
    ],
  },
  footer: {
    wordmark: 'babypanda',
    label: 'BabyPanda — autonomous coding agent',
    meta: '© 2026 Armaan Amoli · MIT License',
    columns: [
      {
        title: 'Project',
        links: [
          { label: 'GitHub', href: 'https://github.com/ArmaanAmoli/BabyPanda' },
          { label: 'Releases', href: 'https://github.com/ArmaanAmoli/BabyPanda/releases' },
          { label: 'Docs', href: docsUrl() },
        ],
      },
      {
        title: 'Author',
        links: [{ label: 'Armaan Amoli', href: 'https://github.com/ArmaanAmoli' }],
      },
    ],
  },
};
