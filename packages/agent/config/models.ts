import { z } from 'zod';
import { ReasoningEffort } from '@baby-panda/types';

export enum ProvidersEnum {
  Nvidia = 'Nvidia',
}

const ProvidersEnumSchema = z.enum(ProvidersEnum);

/**
 * How a message's `content` has to be shaped in the request body.
 *
 * - `string`: the plain OpenAI string every model here accepts.
 * - `parts`: the multimodal parts array (`[{ type: 'text', text }]`) that
 *   moonshotai/kimi-k3.1-pro documents for user messages.
 */
export enum ContentFormat {
  string = 'string',
  parts = 'parts',
}

const ModelDetailSchema = z.object({
  contextLength: z.number(),
  reasoningEfforts: z.array(z.enum(ReasoningEffort)),
  /**
   * Whether the endpoint accepts the OpenAI fields this client would otherwise
   * always send: `temperature`, `top_p`, `frequency_penalty`,
   * `presence_penalty` and `tool_choice`. NVIDIA's kimi-k3.1-pro schema sets
   * `additionalProperties: false` and fixes temperature at 0.95 server-side, so
   * those fields are omitted for it instead of failing the whole request.
   */
  supportsOpenAiExtensions: z.boolean().default(true),
  contentFormat: z.enum(ContentFormat).default(ContentFormat.string),
});

export type ModelDetails = z.infer<typeof ModelDetailSchema>;

const ProviderDetailsSchema = z.object({
  url: z.string(),
  models: z.record(z.string(), ModelDetailSchema),
});

export const ModelsSchema = z.record(ProvidersEnumSchema, ProviderDetailsSchema);

/**
 * Efforts offered on a model whose own enum has not been pinned down yet.
 *
 * Deliberately an explicit list rather than `Object.values(ReasoningEffort)`:
 * the accepted vocabulary is per-model on NVIDIA NIM (Nemotron answers `max`
 * with a 400), so a new effort must be opted into per model instead of
 * appearing everywhere the moment it is added to the enum.
 */
const DEFAULT_EFFORTS = [
  ReasoningEffort.none,
  ReasoningEffort.low,
  ReasoningEffort.medium,
  ReasoningEffort.high,
];

// Input rather than output type: the two new model fields carry defaults, so a
// model entry may omit them and still satisfy the schema.
type ModelsType = z.input<typeof ModelsSchema>;

export const Models: ModelsType = {
  Nvidia: {
    url: 'https://integrate.api.nvidia.com/v1/chat/completions',
    models: {
      'z-ai/glm-5.3-flash': {
        contextLength: 1_000_000,
        // NVIDIA documents `low | high | max`; the endpoint also accepts
        // `none`/`minimal`/`medium`/`xhigh` but runs them at `max`.
        reasoningEfforts: [ReasoningEffort.low, ReasoningEffort.high, ReasoningEffort.max],
      },
      'stepfun-ai/step-5-preview': {
        contextLength: 1_000_000,
        reasoningEfforts: [ReasoningEffort.low, ReasoningEffort.medium, ReasoningEffort.high],
      },

      'nvidia/nemotron-3-ultra-550b-a55b': {
        contextLength: 1_000_000,
        reasoningEfforts: [ReasoningEffort.none, ReasoningEffort.medium, ReasoningEffort.high],
      },

      'nvidia/nemotron-3.5-lightning-30b-a3b': {
        contextLength: 1000000,
        // Unverified on purpose: this endpoint's schema documents no
        // `reasoning_effort` field at all (it exposes `reasoning_budget` and
        // `chat_template_kwargs.enable_thinking` instead), so no list here is
        // correct. It also has no `tools` field and no `tool` role, so the
        // agent cannot drive it until the client stops sending those.
        reasoningEfforts: DEFAULT_EFFORTS,
      },
      'nvidia/nemotron-3.5-super-vl-120b-a12b': {
        contextLength: 262000,
        // Taken from the endpoint's OpenAPI enum. Its get-started prose
        // instead says `low | medium | high`, which conflicts; the schema is
        // the contract our request is validated against.
        reasoningEfforts: [ReasoningEffort.none, ReasoningEffort.low, ReasoningEffort.high],
      },
      'mistralai/mistral-large-4-1t-a52b': {
        contextLength: 262000,
        // Mistral documents `low | medium | high` and rejects `none` with a
        // 400. NVIDIA's API-reference enum for this model still lists the
        // Large 4 *preview* pair `none | high` and is stale -- it even claims
        // an omitted field is "served as none", which the current docs
        // contradict. Trust the vendor docs, not that enum.
        reasoningEfforts: [ReasoningEffort.low, ReasoningEffort.medium, ReasoningEffort.high],
      },
      'minimaxai/minimax-m3.1-flash': {
        contextLength: 262000,
        // MiniMax documents `low | medium | high | xhigh | max` and rejects
        // `none` with a 400, so `none` must not be offered here.
        reasoningEfforts: [
          ReasoningEffort.low,
          ReasoningEffort.medium,
          ReasoningEffort.high,
          ReasoningEffort.xhigh,
          ReasoningEffort.max,
        ],
      },
      'meta/muse-glimmer-30b': {
        contextLength: 131000,
        reasoningEfforts: [
          ReasoningEffort.none,
          ReasoningEffort.minimal,
          ReasoningEffort.low,
          ReasoningEffort.medium,
          ReasoningEffort.high,
          ReasoningEffort.max,
        ],
      },
      'moonshotai/kimi-k3.1-pro': {
        contextLength: 1_000_000,
        // NVIDIA documents `low | high | max` for this model; `none` and
        // `medium` are outside its enum and would be rejected.
        reasoningEfforts: [ReasoningEffort.low, ReasoningEffort.high, ReasoningEffort.max],
        supportsOpenAiExtensions: false,
        contentFormat: ContentFormat.parts,
      },
    },
  },
};

export type ProviderModel = keyof (typeof Models)[ProvidersEnum]['models'];

export function getProviderModels(provider: ProvidersEnum) {
  return Object.keys(Models[provider].models);
}
