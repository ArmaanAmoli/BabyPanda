import type { DocPage } from '../types';

const page: DocPage = {
  slug: 'providers',
  group: 'Concepts',
  category: 'Concepts',
  title: 'Providers and models',
  subtitle:
    'How a provider is registered, which one is supported, and what a reasoning effort does.',
  blocks: [
    {
      kind: 'callout',
      variant: 'warning',
      title: 'NVIDIA NIM only',
      text: 'Only the NVIDIA NIM provider is wired up at runtime. Other providers are not ready for use, even though provider data is stored in the database — the endpoint and the API key are hard-coded to the NVIDIA integration path.',
    },
    { kind: 'heading', level: 2, text: 'How providers are registered' },
    {
      kind: 'p',
      text: 'A provider is a name, an endpoint URL and an API key. The key is stored in the `api_keys` table of the local database, never in a file and never in the repository. You configure it from the setup prompt when the CLI starts, or later with `/api-key`.',
    },
    {
      kind: 'p',
      text: 'The server exposes the catalogue through `GET /providers`, which merges the static model list in `packages/agent/config/models.ts` with whatever keys are saved, so the CLI can show which providers already have a key.',
    },
    {
      kind: 'code',
      lang: 'ts',
      title: 'packages/agent/config/models.ts',
      code: "export const Models: ModelsType = {\n  Nvidia: {\n    url: 'https://integrate.api.nvidia.com/v1/chat/completions',\n    models: {\n      'z-ai/glm-5.3-flash': {\n        contextLength: 1_000_000,\n        reasoningEfforts: [ReasoningEffort.low, ReasoningEffort.high, ReasoningEffort.max],\n        multimodal: true,\n      },\n      // …\n    },\n  },\n};",
    },
    {
      kind: 'p',
      text: 'Adding a provider means adding an entry to `Models` and a matching row in `ProvidersEnum`. Nothing else in the agent needs to change: the client reads the endpoint and the model list from that one object.',
    },
    { kind: 'heading', level: 2, text: 'Supported providers' },
    {
      kind: 'table',
      head: ['Provider', 'Endpoint', 'Status'],
      rows: [
        ['`Nvidia`', '`https://integrate.api.nvidia.com/v1/chat/completions`', 'Supported'],
        ['Others', '—', 'Not ready for use'],
      ],
    },
    { kind: 'heading', level: 2, text: 'Models' },
    {
      kind: 'p',
      text: 'Every model entry declares its context length, the reasoning efforts it accepts, and whether it is multimodal. The effort list is deliberately explicit rather than derived from the `ReasoningEffort` enum, because the accepted vocabulary is per-model on NVIDIA NIM — Nemotron answers `max` with a 400 — so a new effort has to be opted into per model.',
    },
    {
      kind: 'table',
      head: ['Model', 'Context', 'Reasoning efforts', 'Multimodal'],
      rows: [
        ['`z-ai/glm-5.3-flash`', '1,000,000', '`low` `high` `max`', 'Yes'],
        ['`stepfun-ai/step-5-preview`', '1,000,000', '`low` `medium` `high`', 'Yes'],
        ['`nvidia/nemotron-3-ultra-550b-a55b`', '1,000,000', '`none` `medium` `high`', 'No'],
        [
          '`nvidia/nemotron-3.5-lightning-30b-a3b`',
          '1,000,000',
          '`none` `low` `medium` `high`',
          'No',
        ],
        ['`nvidia/nemotron-3.5-super-vl-120b-a12b`', '262,000', '`none` `low` `high`', 'Yes'],
        ['`mistralai/mistral-large-4-1t-a52b`', '262,000', '`low` `medium` `high`', 'Yes'],
        ['`minimaxai/minimax-m3.1-flash`', '262,000', '`low` `medium` `high` `xhigh` `max`', 'Yes'],
        [
          '`meta/muse-glimmer-30b`',
          '131,000',
          '`none` `minimal` `low` `medium` `high` `max`',
          'Yes',
        ],
        ['`moonshotai/kimi-k3.1-pro`', '1,000,000', '`low` `high` `max`', 'Yes'],
      ],
    },
    {
      kind: 'callout',
      variant: 'note',
      title: 'Two entries carry caveats',
      text: '`nvidia/nemotron-3.5-lightning-30b-a3b` documents no `reasoning_effort` field at all, so its list is a placeholder and the agent cannot drive it until the client stops sending tool fields it has no `tool` role for. `moonshotai/kimi-k3.1-pro` sets `additionalProperties: false` and fixes temperature server-side, so the OpenAI extension fields are omitted for it rather than failing the request.',
    },
    { kind: 'heading', level: 2, text: 'Reasoning effort' },
    {
      kind: 'p',
      text: '`/efforts` picks how much the model thinks before answering. The portable levels are `none`, `low`, `medium` and `high`; some models also accept `minimal`, `xhigh` and `max`. The choice is stored on the session row, so reopening a session restores it.',
    },
    {
      kind: 'p',
      text: 'The default effort is `none`, which not every model accepts — MiniMax answers it with a 400 — so the agent validates the default against the model’s own list on startup and falls back to the first entry that is accepted.',
    },
    { kind: 'heading', level: 2, text: 'API keys' },
    {
      kind: 'p',
      text: 'Provider keys live in the local database. `/api-key` changes the saved key for the active provider or for Exa; `/web-api-keys` reaches the Exa key directly. A key saved mid-session is pushed over the WebSocket so it takes effect without a restart.',
    },
    {
      kind: 'callout',
      variant: 'warning',
      title: 'Never paste a key',
      text: 'Do not paste provider keys into source code, logs, issues or pull requests. Your keys stay on your machine; use only keys and providers you are permitted to use, and follow their terms.',
    },
  ],
};

export default page;
