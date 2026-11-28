import type { DocPage } from '../types';

const page: DocPage = {
  slug: 'context-management',
  group: 'Concepts',
  category: 'Concepts',
  title: 'Context management',
  subtitle: 'What happens when a conversation outgrows the model’s context window.',
  blocks: [
    {
      kind: 'p',
      text: 'A session’s context is finite: the model has a context length, and the agent counts the tokens it has put into the request against it. When the count crosses a threshold, the agent compacts — it replaces the verbatim history with a summary the model writes about itself.',
    },
    { kind: 'heading', level: 2, text: 'The trigger' },
    {
      kind: 'p',
      text: 'Compaction runs at the top of the agent loop, before a request is issued, once the used tokens reach **75% of the context window**:',
    },
    {
      kind: 'code',
      lang: 'ts',
      title: 'packages/agent/agent.ts',
      code: "if (this.contextWindowUsed >= this.contextWindow * 0.75) {\n  const compactionEvent: CompactionEventPayload = { compacting: true };\n  this.emit('compaction', compactionEvent);\n  try {\n    const summary = await compaction(this);\n    // …store the summary, rebuild the context, reset the counter…\n  } finally {\n    this.emit('compaction', { compacting: false });\n  }\n}",
    },
    {
      kind: 'p',
      text: 'The terminal is told when compaction starts and finishes, so the status bar can show it. The `finally` guarantees the indicator is cleared even when compaction fails.',
    },
    { kind: 'heading', level: 2, text: 'What compaction does' },
    {
      kind: 'list',
      ordered: true,
      items: [
        'The agent loads the most recent compaction summary, if there is one, and takes every message stored after it.',
        'Those messages are normalised into the provider’s message shape, with the previous summary prepended as the opening `user` message.',
        'A dedicated summarisation request is issued: the BabyPanda system instructions, the history, and the compaction instructions from `packages/agent/memory/BabyPanda/Compaction.md`.',
        'The reply is streamed. If the model stops mid-output (`finish_reason` of `length` or `null`), the agent asks it to continue exactly where it left off, up to three times.',
        'The finished summary is stored as a message with the `compaction` role, the in-memory history is rebuilt, and the token counter is reset to zero.',
      ],
    },
    {
      kind: 'p',
      text: 'The summary is stored with the `compaction` role because the provider only understands `user`, `assistant`, `tool` and `system`. It is presented to the model as a `user` message.',
    },
    { kind: 'heading', level: 2, text: 'What is kept' },
    {
      kind: 'p',
      text: 'Everything after the last summary is summarised, and the summary itself is carried forward into the next compaction — so history is folded, not dropped. Rows with the `skill` role are excluded from summarisation: they are user-injected skill bodies that keep their position in the history and are never condensed away.',
    },
    {
      kind: 'callout',
      variant: 'warning',
      title: 'TODO — "50 most recent messages kept as-is" is not implemented',
      text: 'The intended design was to summarise older history while leaving the 50 most recent messages verbatim. The code does not do that: `getMessagesForSummary` returns every message after the last summary, with no tail window, and nothing in `packages/agent` or `packages/db` slices the recent messages back out. Until that is implemented, a compaction rewrites the whole history into one summary.',
    },
    { kind: 'heading', level: 2, text: 'What the summary must contain' },
    {
      kind: 'p',
      text: 'The compaction instructions ask for nine fixed sections, in order, so a fresh agent can resume with no loss of continuity:',
    },
    {
      kind: 'list',
      ordered: true,
      items: [
        'Intent and objectives',
        'Technical concepts and architecture',
        'Files touched or modified',
        'Errors encountered and fixes',
        'All user messages summary',
        'Pending tasks and TODOs',
        'Current workstate',
        'Verification and testing status',
        'Critical blockers',
      ],
    },
    {
      kind: 'p',
      text: 'The instructions ask for technical density over readability and for exact paths, function names and command outputs rather than paraphrase — a summary that says "updated some files" is treated as a failure.',
    },
    { kind: 'heading', level: 2, text: 'Failure handling' },
    {
      kind: 'p',
      text: 'If compaction fails, the error is logged and the agent loop stops rather than issuing a request that would overflow the window. The session stays open and its history is intact, so you can start a new session and pick the work up from the notes.',
    },
    {
      kind: 'callout',
      variant: 'note',
      title: 'Notes outlive compaction',
      text: 'Because a compaction rewrites the history, anything that must survive it should be written to a note or to memory rather than left in the transcript.',
    },
  ],
};

export default page;
