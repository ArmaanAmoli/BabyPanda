// src/docs/highlight.ts
// A very small syntax highlighter for the docs code blocks.
//
// It exists instead of shiki or Prism because the docs carry a couple of dozen
// short snippets in five languages, and a tokeniser that fits on one screen
// costs a few hundred bytes instead of a few hundred kilobytes of grammar and
// theme data. It is deliberately not a complete lexer: it highlights the
// constructs a reader scans for — comments, strings, keywords, numbers, flag
// names and call sites — and leaves everything else plain.
//
// Each language is an ordered list of rules. The rules are joined into one
// alternation, so the first rule that matches at a position wins; that is why
// comments and strings come first and keywords last.

import type { CodeLang } from './types';

/** What a run of text is, for colouring. */
export type TokenType =
  'plain' | 'comment' | 'string' | 'keyword' | 'number' | 'flag' | 'function' | 'punct';

export interface Token {
  type: TokenType;
  value: string;
}

/**
 * Tailwind class for each token type, all derived from the shared theme in
 * src/index.css. Kept beside the tokeniser so the two cannot drift.
 */
export const TOKEN_CLASS: Record<TokenType, string> = {
  plain: '',
  comment: 'text-faint italic',
  string: 'text-accent/85',
  keyword: 'text-accent',
  number: 'text-ink/80',
  flag: 'text-accent/85',
  function: 'text-ink',
  punct: 'text-ink/45',
};

interface Rule {
  type: TokenType;
  /** A regular-expression source. Must not contain capture groups. */
  source: string;
}

// The sources below are written as plain strings rather than regex literals so
// that every language can share one combined matcher. Backslashes are therefore
// doubled, exactly as they would be in any other string.

/** Shell comments are `#` only: a `//` in a URL is not a comment. */
const HASH_COMMENT: Rule = { type: 'comment', source: '#[^\\n]*' };
/** C-style comments, for the TypeScript snippets. */
const SLASH_COMMENT: Rule = { type: 'comment', source: '//[^\\n]*|/\\*[\\s\\S]*?\\*/' };
const STRING: Rule = { type: 'string', source: '"[^"\\n]*"|\'[^\'\\n]*\'|`[^`\\n]*`' };
const NUMBER: Rule = { type: 'number', source: '\\b\\d[\\d_]*(?:\\.\\d+)?\\b' };
const PUNCT: Rule = { type: 'punct', source: '[{}()\\[\\];,.:?=<>+\\-*/%!&|^~]' };

const BASH_KEYWORDS =
  'if|then|else|elif|fi|for|while|do|done|case|esac|function|return|export|local|set|unset|source|echo|cd|curl|bash|sh|sudo|mkdir|cp|mv|rm|ln|install|exit|trap';

const TS_KEYWORDS =
  'import|from|export|as|default|const|let|var|function|return|if|else|for|while|switch|case|break|continue|new|class|extends|implements|interface|type|enum|namespace|declare|async|await|try|catch|finally|throw|typeof|instanceof|in|of|keyof|readonly|public|private|protected|static|abstract|void|never|unknown|any|null|undefined|true|false|this|super|yield';

const SQL_KEYWORDS =
  'select|from|where|and|or|not|null|insert|into|values|update|set|delete|create|table|primary|key|foreign|references|on|cascade|default|order|by|asc|desc|limit|join|left|right|inner|outer|group|having|distinct|as|index|unique';

/** Wrap a keyword list in word boundaries. */
function words(list: string): string {
  return `\\b(?:${list})\\b`;
}

/** Rules per language, most specific first. */
const RULES: Record<CodeLang, Rule[]> = {
  bash: [
    HASH_COMMENT,
    STRING,
    { type: 'flag', source: '(?<=\\s)--?[A-Za-z][\\w-]*' },
    { type: 'keyword', source: words(BASH_KEYWORDS) },
    { type: 'function', source: '\\b[A-Za-z_][\\w-]*(?=\\s)' },
    NUMBER,
    PUNCT,
  ],
  ts: [
    SLASH_COMMENT,
    STRING,
    { type: 'keyword', source: words(TS_KEYWORDS) },
    { type: 'function', source: '\\b[A-Za-z_$][\\w$]*(?=\\()' },
    NUMBER,
    PUNCT,
  ],
  tsx: [
    SLASH_COMMENT,
    STRING,
    { type: 'keyword', source: words(TS_KEYWORDS) },
    { type: 'function', source: '\\b[A-Za-z_$][\\w$]*(?=\\()' },
    NUMBER,
    PUNCT,
  ],
  json: [
    { type: 'function', source: '"[^"\\n]*"(?=\\s*:)' },
    STRING,
    { type: 'keyword', source: words('true|false|null') },
    NUMBER,
    PUNCT,
  ],
  sql: [HASH_COMMENT, STRING, { type: 'keyword', source: words(SQL_KEYWORDS) }, NUMBER, PUNCT],
  text: [],
};

/** One compiled matcher per language, built once. `null` means "no rules". */
const MATCHERS: Record<CodeLang, RegExp | null> = Object.fromEntries(
  (Object.keys(RULES) as CodeLang[]).map((lang) => {
    const rules = RULES[lang];
    if (rules.length === 0) return [lang, null] as const;
    const source = rules.map((rule) => `(${rule.source})`).join('|');
    return [lang, new RegExp(source, 'g')] as const;
  }),
) as Record<CodeLang, RegExp | null>;

/**
 * Split `code` into coloured tokens.
 *
 * The combined matcher finds the next interesting run; everything between two
 * matches is emitted as plain text. Which alternative matched is recovered
 * from the capture-group index, so a rule may safely contain non-capturing
 * groups of its own.
 */
export function highlight(code: string, lang: CodeLang): Token[] {
  const matcher = MATCHERS[lang];
  if (!matcher) return [{ type: 'plain', value: code }];

  const rules = RULES[lang];
  const tokens: Token[] = [];
  let cursor = 0;
  matcher.lastIndex = 0;

  const push = (type: TokenType, value: string): void => {
    if (value === '') return;
    const last = tokens[tokens.length - 1];
    if (last && last.type === type) {
      last.value += value;
      return;
    }
    tokens.push({ type, value });
  };

  for (let match = matcher.exec(code); match !== null; match = matcher.exec(code)) {
    if (match.index > cursor) {
      push('plain', code.slice(cursor, match.index));
    }
    // `match.slice()` keeps the whole match at index 0, so rule `i` owns group
    // `i + 1`. The array is widened because an unmatched group is absent.
    const groups: (string | undefined)[] = match.slice();
    let matched = false;
    for (let index = 0; index < rules.length; index += 1) {
      const captured = groups[index + 1];
      if (captured !== undefined) {
        push(rules[index].type, captured);
        matched = true;
        break;
      }
    }
    if (!matched) {
      push('plain', match[0]);
    }
    cursor = match.index + match[0].length;
    // A zero-length match would spin forever; step past it.
    if (match[0].length === 0) matcher.lastIndex += 1;
  }
  if (cursor < code.length) {
    push('plain', code.slice(cursor));
  }
  return tokens;
}
