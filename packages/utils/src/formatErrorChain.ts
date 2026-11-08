/** sqlite error fields as surfaced by bun:sqlite / libsql drivers. */
type SqliteErrorFields = {
  code?: string | number;
  rawCode?: number;
};

/**
 * Stringifies an error *including its full `cause` chain*.
 *
 * `${error}` only renders the top-level wrapper (e.g. Drizzle's
 * `DrizzleQueryError: Failed query: ...`), which hides the real driver error
 * stored in `error.cause`. Every level is printed with its name, message and
 * any sqlite (`code` / `rawCode`) fields, indented so the chain reads as a
 * causal sequence:
 *
 *   DrizzleQueryError: Failed query: select ...
 *     caused by SqliteError: unable to open database file [code=SQLITE_CANTOPEN]
 *
 * Truncated messages stay aligned to one line each so grep over db.log works.
 */
export function formatErrorChain(error: unknown, maxDepth: number = 6): string {
  const parts: string[] = [];
  let current: unknown = error;
  let depth = 0;

  while (current !== undefined && current !== null && depth <= maxDepth) {
    if (current instanceof Error) {
      const err = current as Error & SqliteErrorFields;
      let line =
        depth === 0 ? `${err.name}: ${err.message}` : `caused by ${err.name}: ${err.message}`;
      if (err.code !== undefined) line += ` [code=${String(err.code)}]`;
      if (err.rawCode !== undefined) line += ` [rawCode=${String(err.rawCode)}]`;
      parts.push(line);
      current = err.cause;
    } else {
      // Non-Error cause (e.g. a string rejection reason): the chain ends here.
      parts.push(depth === 0 ? String(current) : `caused by ${String(current)}`);
      break;
    }
    depth++;
  }

  return parts.join('\n  ');
}
