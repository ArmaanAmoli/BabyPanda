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

// Input rather than output type: the two new model fields carry defaults, so a
// model entry may omit them and still satisfy the schema.
type ModelsType = z.input<typeof ModelsSchema>;

export const Models: ModelsType = {
  Nvidia: {
    url: 'https://integrate.api.nvidia.com/v1/chat/completions',
    models: {
      'z-ai/glm-5.3-flash': {
        contextLength: 1_000_000,
        reasoningEfforts: Object.values(ReasoningEffort),
      },
      'stepfun-ai/step-5-preview': {
        contextLength: 1_000_000,
        reasoningEfforts: Object.values(ReasoningEffort),
      },

      'nvidia/nemotron-3-ultra-550b-a55b': {
        contextLength: 1_000_000,
        reasoningEfforts: Object.values(ReasoningEffort),
      },

      'nvidia/nemotron-3.5-lightning-30b-a3b': {
        contextLength: 1000000,
        reasoningEfforts: Object.values(ReasoningEffort),
      },
      'nvidia/nemotron-3.5-super-vl-120b-a12b': {
        contextLength: 262000,
        reasoningEfforts: Object.values(ReasoningEffort),
      },
      'mistralai/mistral-large-4-1t-a52b': {
        contextLength: 262000,
        reasoningEfforts: Object.values(ReasoningEffort),
      },
      'minimaxai/minimax-m3.1-flash': {
        contextLength: 262000,
        reasoningEfforts: Object.values(ReasoningEffort),
      },
      'meta/muse-glimmer-30b': {
        contextLength: 131000,
        reasoningEfforts: Object.values(ReasoningEffort),
      },
      'moonshotai/kimi-k3.1-pro': {
        contextLength: 1_000_000,
        // NVIDIA documents only `low` and `high` for this model; `none` and
        // `medium` are outside its enum and would be rejected.
        reasoningEfforts: [ReasoningEffort.low, ReasoningEffort.high],
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
