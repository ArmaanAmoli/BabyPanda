// src/content.ts
// Every string, link and list rendered on the page lives in this file.
// Components read from `content` and never hard-code copy, URLs or commands.
// Replace every value marked with a trailing `// SAMPLE` comment.

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

/** One call-to-action button. */
export interface Cta {
  /** Visible button text. */
  label: string;
  /** Target anchor or URL. */
  href: string;
}

/** Hero section copy. */
export interface HeroContent {
  /** Big headline. */
  headline: string;
  /** Supporting paragraph under the headline. */
  subhead: string;
  /** Primary button (filled). */
  primaryCta: Cta;
  /** Secondary button (outlined). */
  secondaryCta: Cta;
}

/** How a terminal-demo line is styled. */
export type TerminalLineKind = 'user' | 'thought' | 'tool' | 'answer';

export interface TerminalLine {
  /** Rendering treatment: user prompt, dim thought, tool call, or answer. */
  kind: TerminalLineKind;
  /** The line's text. */
  text: string;
}

export interface TerminalDemoContent {
  /** Title shown in the terminal window's title bar. */
  title: string;
  /** Lines rendered top to bottom inside the terminal window. */
  lines: TerminalLine[];
}

/** One feature card. There must be exactly 6. */
export interface Feature {
  /** Card heading. */
  title: string;
  /** Card body text. */
  description: string;
}

export interface InstallStep {
  /** Short label above the command. */
  label: string;
  /** The command shown in the code block and copied by the copy button. */
  command: string;
}

export interface InstallContent {
  /** Section heading. */
  title: string;
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
  terminalDemo: TerminalDemoContent;
  features: Feature[];
  stack: string[];
  install: InstallContent;
  footer: FooterContent;
}

export const content: Content = {
  site: {
    name: 'BabyPanda', // SAMPLE
    tagline: 'An autonomous coding agent that lives in your terminal', // SAMPLE
    description:
      'BabyPanda is a terminal-based autonomous coding agent. Point it at a task, approve its plan, and it edits files, runs tools and tests for you.', // SAMPLE
    githubUrl: 'https://github.com/your-username/babypanda', // SAMPLE
    authorName: 'Your Name', // SAMPLE
    authorGithubUrl: 'https://github.com/your-username', // SAMPLE
    year: 2026, // SAMPLE
  },
  hero: {
    headline: 'Point it at a task. Get back a diff.', // SAMPLE
    subhead:
      'BabyPanda reads your repo, plans the change, then edits files and runs your tests from the command line — every step streamed, every tool call visible.', // SAMPLE
    primaryCta: { label: 'Install in one line', href: '#install' }, // SAMPLE
    secondaryCta: { label: 'Watch it work', href: '#demo' }, // SAMPLE
  },
  terminalDemo: {
    title: 'babypanda — zsh — 80×24', // SAMPLE
    lines: [
      { kind: 'user', text: 'babypanda "fix the flaky retry test in src/api/client.ts"' }, // SAMPLE
      {
        kind: 'thought',
        text: 'Reading src/api/client.ts — the retry sleeps a fixed 100ms, so the test races the clock.',
      }, // SAMPLE
      { kind: 'tool', text: 'read_file src/api/client.ts' }, // SAMPLE
      { kind: 'tool', text: 'run_tests tests/api/client.test.ts' }, // SAMPLE
      {
        kind: 'thought',
        text: 'Fails 1 in 5 runs. Replacing the fixed sleep with exponential backoff keyed to the attempt number.',
      }, // SAMPLE
      { kind: 'tool', text: 'edit src/api/client.ts (+3 −2)' }, // SAMPLE
      { kind: 'tool', text: 'run_tests tests/api/client.test.ts — 20/20 passed' }, // SAMPLE
      {
        kind: 'answer',
        text: 'Done. Retries now back off exponentially; 20 consecutive green runs.',
      }, // SAMPLE
    ],
  },
  features: [
    {
      title: 'Streamed agent loop', // SAMPLE
      description:
        'Thoughts, tool calls and answers stream into your terminal as they happen — no spinner, no waiting for a final blob.', // SAMPLE
    },
    {
      title: 'Tool use over MCP', // SAMPLE
      description:
        'File edits, shell commands and tests run through MCP servers, so every action the agent takes is inspectable and revocable.', // SAMPLE
    },
    {
      title: 'Interactive terminal UI', // SAMPLE
      description:
        'A React Ink interface with prompts, diffs and approvals inline. Approve, redirect or interrupt without leaving the keyboard.', // SAMPLE
    },
    {
      title: 'Persistent sessions', // SAMPLE
      description:
        'Sessions are stored in SQLite and resume where they left off — reconnect after a reboot and the agent still knows the task.', // SAMPLE
    },
    {
      title: 'Automatic context compaction', // SAMPLE
      description:
        'Long tasks are summarized and compacted automatically, so the context window survives multi-hour jobs.', // SAMPLE
    },
    {
      title: 'Project-scoped memory', // SAMPLE
      description:
        'Decisions and conventions are remembered per repo in a local memory file, so the agent stops re-asking the same questions.', // SAMPLE
    },
  ],
  stack: [
    'TypeScript', // SAMPLE
    'Bun', // SAMPLE
    'React Ink', // SAMPLE
    'Hono', // SAMPLE
    'SQLite', // SAMPLE
    'Drizzle', // SAMPLE
    'MCP', // SAMPLE
    'Zod', // SAMPLE
  ],
  install: {
    title: 'Install', // SAMPLE
    steps: [
      { label: 'Install globally with npm', command: 'npm install -g babypanda' }, // SAMPLE
      { label: 'Or with Bun', command: 'bun add -g babypanda' }, // SAMPLE
      { label: 'Start a session in any repo', command: 'cd your-project && babypanda' }, // SAMPLE
    ],
  },
  footer: {
    wordmark: 'babypanda', // SAMPLE
    label: 'BabyPanda — autonomous coding agent', // SAMPLE
    meta: '© 2026 Your Name · MIT License', // SAMPLE
    columns: [
      {
        title: 'Project', // SAMPLE
        links: [
          { label: 'GitHub', href: 'https://github.com/your-username/babypanda' }, // SAMPLE
          { label: 'Releases', href: 'https://github.com/your-username/babypanda/releases' }, // SAMPLE
          {
            label: 'Changelog',
            href: 'https://github.com/your-username/babypanda/blob/main/CHANGELOG.md',
          }, // SAMPLE
        ],
      },
      {
        title: 'Docs', // SAMPLE
        links: [
          { label: 'Quickstart', href: '#install' }, // SAMPLE
          { label: 'Terminal demo', href: '#demo' }, // SAMPLE
          { label: 'MCP servers', href: '#features' }, // SAMPLE
        ],
      },
      {
        title: 'Author', // SAMPLE
        links: [
          { label: 'your-username', href: 'https://github.com/your-username' }, // SAMPLE
          { label: 'Email', href: 'mailto:you@example.com' }, // SAMPLE
        ],
      },
    ],
  },
};
