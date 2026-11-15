/**
 * Bun resolves `import x from './file.md' with { type: 'text' }` to the file's
 * contents as a string. TypeScript has no built-in shape for that, and the
 * agent embeds its instruction files this way so a compiled binary does not
 * depend on a real directory to read them from.
 *
 * This must stay a script (no top-level import/export): inside a module,
 * `declare module` is an augmentation and TypeScript rejects a wildcard that
 * matches nothing. Packages that compile the agent's sources reference this
 * file from their tsconfig `include`.
 */
declare module '*.md' {
  const content: string;
  export default content;
}
