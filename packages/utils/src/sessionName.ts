/**
 * Session naming rules.
 *
 * A session is labelled the moment it is created, so the terminal status bar
 * and `babypanda list` always have something human-readable to show. Labels
 * are unique per project directory, which is what makes them usable as a
 * handle inside one folder without needing any global registry.
 */

/** Prefix of the label a session carries until the user names it. */
export const UNTITLED_SESSION_NAME_PREFIX = 'untitled-';

/**
 * Longest label a session may carry. The status bar is a single row and the
 * list table is meant to be scanned, so an unbounded name would wreck both.
 */
export const MAX_SESSION_NAME_LENGTH = 64;

/** `untitled-<n>`: the label a session gets before the user names it. */
export function formatUntitledSessionName(number: number): string {
  return `${UNTITLED_SESSION_NAME_PREFIX}${number}`;
}

/** The `<n>` of an `untitled-<n>` label, or `null` for any other name. */
export function untitledSessionNameNumber(name: string): number | null {
  if (!name.startsWith(UNTITLED_SESSION_NAME_PREFIX)) {
    return null;
  }
  const suffix = name.slice(UNTITLED_SESSION_NAME_PREFIX.length);
  if (!/^\d+$/.test(suffix)) {
    return null;
  }
  return Number(suffix);
}

/**
 * Control characters would corrupt the status bar and the list table, and
 * they can never be typed deliberately, so they are rejected outright.
 */
function hasControlCharacter(value: string): boolean {
  for (const character of value) {
    const code = character.codePointAt(0) ?? 0;
    if (code <= 0x1f || code === 0x7f) {
      return true;
    }
  }
  return false;
}

/**
 * A user-supplied label, or `null` when it cannot be used.
 *
 * Surrounding whitespace is dropped, but the rest is left alone: a label is a
 * title rather than an identifier, so spaces and punctuation are fine. The
 * caller decides what to do about an unusable name — this only reports it.
 */
export function normalizeSessionName(raw: string): string | null {
  const trimmed = raw.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_SESSION_NAME_LENGTH) {
    return null;
  }
  if (hasControlCharacter(trimmed)) {
    return null;
  }
  return trimmed;
}
